<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, genFileId } from 'element-plus'
import type { UploadInstance, UploadProps, UploadRawFile } from 'element-plus'
import {
  Plus,
  Document,
  CircleCheck,
  ArrowRight,
  Star,
  Close,
  Delete,
  Check
} from '@element-plus/icons-vue'
import HeaderLogo from '../components/HeaderLogo.vue'
import RecognizeResultDrawer from '../components/RecognizeResultDrawer.vue'
import {
  type DocumentItem,
  type ProjectInfo,
  outlineTemplate,
  promptParamsByTitle
} from '../data/mockData'
import { resetProjectForm, processRecognitionResult, getChineseNumber } from '../utils/common'
import { generateDocumentTags } from '../utils/projectInfo'
import { parseSecondaryHeadings } from '../utils/convert'
import {
  createDocument,
  batchCreateDocumentBlocks,
  getDocumentList,
  getDocumentBlocks,
  getDocumentBlockDetail,
  updateDocumentBlock
} from '../service/document'
import {
  generateParagraphBatch,
  uploadFile,
  parseFile,
  extractKey,
} from '../service/ragflow'
import { authStorage } from '../utils/auth'
import { getAllTags, createTag, searchTemplateChapter, type TemplateTag } from '../service/template'

const router = useRouter()

const userInfo = computed(() => authStorage.getUserInfo())
const userId = computed(() => {
  const info = userInfo.value
  return info?.id || ''
})

// ========== 向导状态 ==========
const wizardStep = ref(1)
const wizardSteps = ref([
  { id: 1, title: '关键信息', completed: false },
  { id: 2, title: '目录大纲', completed: false }
])

const wizardForm = ref<ProjectInfo>(resetProjectForm())
const outlineItems = ref<any[]>([])
const autoGenerateOnCreate = ref(true)

// ========== 标签选择 ==========
const wizardAllTags = ref<TemplateTag[]>([])
const wizardProfessionTagId = ref<number | null>(null)
const wizardBusinessTypeTagId = ref<number | null>(null)

const wizardProfessionTags = computed(() =>
  wizardAllTags.value.filter(tag => tag.category === 'profession')
)
const wizardBusinessTypeTags = computed(() =>
  wizardAllTags.value.filter(tag => tag.category === 'business_type')
)

const toggleWizardTag = (tagId: number, category: 'profession' | 'business_type') => {
  if (category === 'profession') {
    wizardProfessionTagId.value = wizardProfessionTagId.value === tagId ? null : tagId
  } else {
    wizardBusinessTypeTagId.value = wizardBusinessTypeTagId.value === tagId ? null : tagId
  }
}

// 自定义标签
const customTagInput = ref('')
const showCustomTagInput = ref(false)
const customTagCategory = ref<'profession' | 'business_type'>('profession')

const addCustomTag = async () => {
  const name = customTagInput.value.trim()
  if (!name) return
  if (wizardAllTags.value.some(t => t.name === name)) {
    customTagInput.value = ''
    showCustomTagInput.value = false
    const existing = wizardAllTags.value.find(t => t.name === name)
    if (existing) {
      if (existing.category === 'profession') {
        wizardProfessionTagId.value = existing.id
      } else if (existing.category === 'business_type') {
        wizardBusinessTypeTagId.value = existing.id
      }
    }
    return
  }
  try {
    const response = await createTag({ name, category: customTagCategory.value })
    if (response.code === 200 && response.data) {
      wizardAllTags.value.push(response.data)
      if (customTagCategory.value === 'profession') {
        wizardProfessionTagId.value = response.data.id
      } else {
        wizardBusinessTypeTagId.value = response.data.id
      }
    }
  } catch (error) {
    console.error('创建标签失败:', error)
  }
  customTagInput.value = ''
  showCustomTagInput.value = false
}

const cancelCustomTag = () => {
  customTagInput.value = ''
  showCustomTagInput.value = false
}

const startAddCustomTag = (category: 'profession' | 'business_type') => {
  customTagCategory.value = category
  showCustomTagInput.value = true
}

const loadWizardTags = async () => {
  try {
    const response = await getAllTags()
    if (response.code === 200 && response.data) {
      wizardAllTags.value = response.data
    }
  } catch (error) {
    console.error('加载标签失败:', error)
  }
}

// ========== 文件上传 ==========
const uploadStatus = ref<'idle'|'uploading'|'success'|'error'>('idle')
const uploadedFileName = ref('')
const uploadedFileId = ref('')
const uploadProgress = ref(0)
const uploadStep = ref<'idle' | 'uploading' | 'parsing' | 'extracting'>('idle')
const uploadRef = ref<UploadInstance>()
const skipConfirmOverwrite = ref(false)

const uploadStepText = computed(() => {
  switch(uploadStep.value) {
    case 'uploading': return '上传中...'
    case 'parsing': return '智能解析中...'
    case 'extracting': return '识别提取中...'
    case 'idle':
      if (uploadStatus.value === 'success') return '已上传'
      return ''
    default: return ''
  }
})

const beforeUpload = (file: File) => {
  const isImage = file.type.startsWith('image/')
  const isPdf = file.type === 'application/pdf'
  const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  const fileName = file.name.toLowerCase()
  const isAllowedExt = fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || fileName.endsWith('.png') || fileName.endsWith('.pdf') || fileName.endsWith('.docx')

  if (!isImage && !isPdf && !isDocx && !isAllowedExt) {
    ElMessage.error('仅支持图片(jpg/png)和文件(pdf/docx)格式')
    return false
  }

  const limit = isImage ? 1 : 2
  if (file.size / 1024 / 1024 > limit) {
    ElMessage.error(`${isImage ? '图片' : '文件'}大小不能超过 ${limit}MB`)
    return false
  }

  if (skipConfirmOverwrite.value) {
    skipConfirmOverwrite.value = false
    return true
  }

  if (uploadStatus.value === 'success') {
    return ElMessageBox.confirm(
      '新上传将覆盖原有的文件和识别结果，确认继续？',
      '提示',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    ).then(() => true).catch(() => false)
  }

  return true
}

const handleExceed: UploadProps['onExceed'] = (files) => {
  ElMessageBox.confirm(
    '新上传将覆盖原有的文件和识别结果，确认继续？',
    '提示',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    uploadRef.value!.clearFiles()
    const file = files[0] as UploadRawFile
    file.uid = genFileId()
    skipConfirmOverwrite.value = true
    uploadRef.value!.handleStart(file)
    uploadRef.value!.submit()
  }).catch(() => {})
}

const handleFileUpload = async (options: any) => {
  try {
    uploadStatus.value = 'uploading'
    uploadStep.value = 'uploading'
    uploadProgress.value = 30
    uploadedFileId.value = ''

    const file = options.file as File
    uploadedFileName.value = file.name

    const uploadRes = await uploadFile(file, 'test_ygy')
    uploadProgress.value = 100
    uploadedFileId.value = uploadRes.data.id

    recognitionResult.value = { total: 0, applied: 0, pending: 0 }
    recognizedFields.value = {}

    ElMessage.success('文件上传成功')
    uploadStatus.value = 'success'
    uploadStep.value = 'idle'

    options.onSuccess && options.onSuccess(uploadRes.data)
  } catch (e: any) {
    ElMessage.error(e?.message || '上传失败')
    uploadStatus.value = 'error'
    options.onError && options.onError(e)
  } finally {
    if(uploadStatus.value !== 'uploading' && uploadStatus.value !== 'success') {
      uploadStep.value = 'idle'
    }
  }
}

const removeUploadedFile = () => {
  uploadedFileName.value = ''
  uploadedFileId.value = ''
  uploadStatus.value = 'idle'
  uploadRef.value?.clearFiles()
}

// ========== 智能识别 ==========
const recognizingProjectInfo = ref(false)
const recognitionResult = ref({ total: 0, applied: 0, pending: 0 })
const recognizedFields = ref<Record<string, { newValue: any, oldValue: any, section: string, status: string }>>({})
const showReviewDrawer = ref(false)

const fieldSectionMap: Record<string, string> = {
  landUseType: 'planning',
  seismicIntensity: 'planning',
  climateZone: 'planning',
  indoorOutdoorHeight: 'terrain',
  absoluteElevation: 'terrain',
  buildingType: 'function',
  buildingName: 'function',
  buildingFunction: 'function',
  buildingArea: 'function',
  plotRatioArea: 'function',
  floors: 'scale',
  buildingHeight: 'scale',
  structureType: 'scale',
  structureDesignLife: 'safety',
  fireResistanceGrade: 'fire',
  fireCategory: 'fire',
  waterproofCategory: 'waterproof',
  roofWaterproofLife: 'waterproof',
  waterproofGrade: 'waterproof',
  energyEfficiencyRequirement: 'energy',
  barrierFreeRequirement: 'barrier-free'
}

const sectionOrder = ['planning','terrain','function','scale','safety','fire','waterproof','energy','barrier-free']
const sectionTitle = (sec: string) => ({
  planning: '规划条件',
  terrain: '地形地貌',
  function: '使用功能',
  scale: '建筑规模与形态',
  safety: '安全等级',
  fire: '防火设计',
  waterproof: '防水设计',
  energy: '节能设计',
  'barrier-free': '无障碍设计'
}[sec] || sec)

const sectionCounts = computed(() => {
  const counts: Record<string, { recognized: number, total: number }> = {}
  Object.entries(fieldSectionMap).forEach(([key, sec]) => {
    counts[sec] = counts[sec] || { recognized: 0, total: 0 }
    counts[sec].total++
    const rf = recognizedFields.value[key]
    if (rf && rf.status !== 'rejected') counts[sec].recognized++
  })
  return counts
})

const recognizeProjectInfo = async () => {
  const projectDescription = wizardForm.value.projectDescription?.trim() || ''
  const hasFile = !!uploadedFileId.value
  const prevForm = { ...wizardForm.value }

  if (!projectDescription && !hasFile) {
    ElMessage.warning('请先输入项目概况或文件')
    return
  }

  try {
    recognitionResult.value = { total: 0, applied: 0, pending: 0 }
    recognizedFields.value = {}
    recognizingProjectInfo.value = true
    ElMessage.info('正在识别项目概况信息...')

    if (hasFile) {
      uploadStatus.value = 'uploading'
      uploadStep.value = 'parsing'
      await parseFile(uploadedFileId.value, 'test_ygy')
      uploadStep.value = 'extracting'
    }

    const extractRes = await extractKey(uploadedFileId.value || '', 'test_ygy', projectDescription)

    let extractedData = null
    if (extractRes.data && extractRes.data.extracted) {
      extractedData = extractRes.data.extracted
    } else {
      throw new Error('识别未返回有效数据')
    }

    if (extractedData) {
      ElMessage.success('项目概况识别完成')

      const { mappedCount, mappedFields, mappedKeys } = processRecognitionResult(extractedData, wizardForm)
      if (mappedCount > 0) {
        recognizedFields.value = {}

        mappedKeys.forEach((key) => {
          const oldValue = (prevForm as any)[key]
          const newValue = (wizardForm.value as any)[key]
          const section = fieldSectionMap[key] || 'other'
          recognizedFields.value[key] = { newValue, oldValue, section, status: 'applied' }
        })

        recognitionResult.value = { total: Object.keys(recognizedFields.value).length, applied: Object.keys(recognizedFields.value).length, pending: 0 }
        ElMessage.success(`成功识别并填充了 ${mappedCount} 个字段：${mappedFields.join('、')}`)
      } else {
        recognitionResult.value = { total: 0, applied: 0, pending: 0 }
        ElMessage.warning('未能识别到可映射的字段信息')
      }
    } else {
      ElMessage.error('识别失败，未能获取有效信息')
    }
  } catch (error: any) {
    console.error('识别项目概况失败:', error)
    ElMessage.error(error.message || '识别失败，请检查网络连接')
    if (hasFile) {
      uploadStatus.value = 'error'
    }
  } finally {
    recognizingProjectInfo.value = false
    if (uploadStatus.value === 'uploading') {
      uploadStatus.value = 'success'
    }
    uploadStep.value = 'idle'
  }
}

const openReviewDrawer = () => {
  showReviewDrawer.value = true
}

const clearField = (key: string) => {
  // @ts-ignore
  wizardForm.value[key] = ''
  if (recognizedFields.value[key]) {
    recognizedFields.value[key].status = 'rejected'
  }
}

// ========== 向导步骤控制 ==========
const loadingNextStep = ref(false)

const nextWizardStep = async () => {
  const docName = wizardForm.value.projectName.trim()
  if (!docName) {
    ElMessage.warning('请输入文档名称')
    return
  }

  const abs_test = wizardForm.value.projectDescription?.trim()
  const hasFile = uploadStatus.value === 'success'
  if(!abs_test && !hasFile){
    ElMessage.warning('未输入项目概况。请输入内容或上传文件')
    return
  }

  loadingNextStep.value = true
  try {
    if (wizardStep.value === 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      const outLines = outlineTemplate.map(item => ({
        id: item.id,
        title: item.title,
        order: item.order ?? item.id,
        children: (item.children || []).map(child => ({
          id: child.id,
          title: child.title,
          order: child.order ?? child.id,
        })),
        expanded: item.expanded ?? ((item.children || []).length > 0)
      }))
      outlineItems.value = outLines
      ElMessage.success('大纲生成成功')
    }
    loadingNextStep.value = false

    if (wizardStep.value < wizardSteps.value.length) {
      const currentStep = wizardSteps.value[wizardStep.value - 1]
      if (currentStep) {
        currentStep.completed = true
      }
      wizardStep.value++
    }
  } catch (error) {
    console.error('生成大纲时发生错误:', error)
    ElMessage.error('生成大纲时发生错误')
  } finally {
    loadingNextStep.value = false
  }
}

const prevWizardStep = () => {
  if (wizardStep.value > 1) {
    wizardStep.value--
    const currentStep = wizardSteps.value[wizardStep.value - 1]
    if (currentStep) {
      currentStep.completed = false
    }
  }
}

// ========== 大纲操作 ==========
const removeOutlineItem = (id: number) => {
  const index = outlineItems.value.findIndex(item => item.id === id)
  if (index > -1) {
    outlineItems.value.splice(index, 1)
    outlineItems.value.forEach((item, index) => {
      item.order = index + 1
    })
  }
}

const updateOutlineTitle = (id: number, title: string) => {
  const item = outlineItems.value.find(item => item.id === id)
  if (item && title) {
    item.title = title
  }
}

let draggedIndex: number | null = null

const handleDragStart = (event: DragEvent, index: number) => {
  draggedIndex = index
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

const handleDrop = (event: DragEvent, dropIndex: number) => {
  event.preventDefault()
  if (draggedIndex !== null && draggedIndex !== dropIndex) {
    const draggedItem = outlineItems.value[draggedIndex]
    if (draggedItem) {
      outlineItems.value.splice(draggedIndex, 1)
      outlineItems.value.splice(dropIndex, 0, draggedItem)
      outlineItems.value.forEach((item, index) => {
        item.order = index + 1
      })
    }
  }
  draggedIndex = null
}

const addOutlineItemAfter = (index: number) => {
  const newId = Math.max(...outlineItems.value.map(item => item.id)) + 1
  const newItem = {
    id: newId,
    title: '新章节',
    order: index + 2,
    children: [],
    expanded: false
  }
  outlineItems.value.splice(index + 1, 0, newItem)
  outlineItems.value.forEach((item, index) => {
    item.order = index + 1
  })
}

const toggleOutlineExpand = (id: number) => {
  const item = outlineItems.value.find(item => item.id === id)
  if (item) {
    item.expanded = !item.expanded
  }
}

let draggedSubInfo: { parentIndex: number, subIndex: number } | null = null

const handleSubDragStart = (event: DragEvent, parentIndex: number, subIndex: number) => {
  draggedSubInfo = { parentIndex, subIndex }
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

const handleSubDrop = (event: DragEvent, dropParentIndex: number, dropSubIndex: number) => {
  event.preventDefault()
  if (draggedSubInfo &&
      (draggedSubInfo.parentIndex !== dropParentIndex || draggedSubInfo.subIndex !== dropSubIndex)) {

    const sourceParent = outlineItems.value[draggedSubInfo.parentIndex]
    const targetParent = outlineItems.value[dropParentIndex]

    if (sourceParent?.children && targetParent?.children) {
      const draggedItem = sourceParent.children[draggedSubInfo.subIndex]
      sourceParent.children.splice(draggedSubInfo.subIndex, 1)
      targetParent.children.splice(dropSubIndex, 0, draggedItem!)
    }
  }
  draggedSubInfo = null
}

const addSubOutlineItemAfter = (parentIndex: number, subIndex: number) => {
  const parentItem = outlineItems.value[parentIndex]
  if (parentItem) {
    if (!parentItem.children) {
      parentItem.children = []
    }

    const allSubIds = outlineItems.value.flatMap(item =>
      item.children?.map((child: any) => child.id) || []
    )
    const newSubId = allSubIds.length > 0 ? Math.max(...allSubIds) + 1 : 1001

    const newSubItem = {
      id: newSubId,
      title: '新子章节',
      order: subIndex + 2
    }

    parentItem.children.splice(subIndex + 1, 0, newSubItem)
    parentItem.expanded = true

    parentItem.children.forEach((child: any, index: number) => {
      child.order = index + 1
    })
  }
}

const updateSubOutlineTitle = (parentId: number, subId: number, title: string) => {
  const parentItem = outlineItems.value.find(item => item.id === parentId)
  if (parentItem?.children) {
    const subItem = parentItem.children.find((child: any) => child.id === subId)
    if (subItem && title) {
      subItem.title = title
    }
  }
}

const removeSubOutlineItem = (parentId: number, subId: number) => {
  const parentItem = outlineItems.value.find(item => item.id === parentId)
  if (parentItem?.children) {
    const subIndex = parentItem.children.findIndex((child: any) => child.id === subId)
    if (subIndex > -1) {
      parentItem.children.splice(subIndex, 1)
      parentItem.children.forEach((child: any, index: number) => {
        child.order = index + 1
      })
    }
  }
}

// ========== 文档创建 ==========
const loadingDocGenarate = ref(false)

const formatSecondaryHeadingLine = (chapterIdx: number, sectionIdx: number, title: string) => {
  return `## ${chapterIdx}.${sectionIdx} ${title}`
}

const createBlocksByDefault = () => {
  const blocks = outlineItems.value.map((item: any, idx: number) => {
    let content = ''
    if (item.children && Array.isArray(item.children) && item.children.length > 0) {
      const contentParts = item.children.map((child: any, cIdx: number) => {
        const title = child.title || ''
        const childContent = child.content || ''
        const heading = formatSecondaryHeadingLine(idx + 1, cIdx + 1, title)
        if (childContent) {
          return `${heading}\n${childContent.trim()}`
        } else {
          return heading
        }
      })
      content = contentParts.join('\n\n')
    }

    const overview = (wizardForm.value.projectDescription || '').trim()
    const isOverviewChapter = idx === 1 || String(item.title || '').trim() === '工程概况'
    if (overview && isOverviewChapter) {
      content = overview
    }

    return {
      block_name: String(item.title || '').trim(),
      block_type: 'heading_1' as const,
      content
    }
  })
  return blocks
}

const createDocumentName = (name: string) => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const currentDate = `${year}${month}${day}`
  return `${name} ${currentDate}`
}

const execCreateDocument = async (docName: string) => {
  let docId = ''
  try {
    const result = await createDocument({
      name: docName,
      userId: userId.value,
      projectInfo: { ...wizardForm.value, professionTagId: wizardProfessionTagId.value ?? undefined, businessTypeTagId: wizardBusinessTypeTagId.value ?? undefined }
    })
    if (result.code === 201 || result.code === 200) {
      docId = result.data?.id || ''
    } else {
      ElMessage.error(result.message || '创建文档失败')
      loadingDocGenarate.value = false
      return ''
    }
  } catch (e) {
    console.error('创建文档接口异常:', e)
    ElMessage.error('创建文档失败，请稍后重试')
    loadingDocGenarate.value = false
    return ''
  }
  return docId
}

const saveProjectData = (docName: string, docId: string) => {
  const projectData = {
    title: docName,
    documentId: docId,
    projectInfo: { ...wizardForm.value, professionTagId: wizardProfessionTagId.value ?? undefined, businessTypeTagId: wizardBusinessTypeTagId.value ?? undefined },
    outline: [...outlineItems.value]
  }
  // 使用 sessionStorage 实现标签页隔离，支持多文档同时创建
  sessionStorage.setItem('currentProject', JSON.stringify(projectData))
}

// 文档创建 - 不生成全部章节
const finishDocumentWizard = async () => {
  const finalDocumentName = createDocumentName(wizardForm.value.projectName)

  if (!userId.value) {
    ElMessage.error('请先登录')
    return null
  }

  loadingDocGenarate.value = true
  let createdDocId = await execCreateDocument(finalDocumentName)

  if (createdDocId) {
    try {
      const blocks = createBlocksByDefault()
      const batchRes = await batchCreateDocumentBlocks(createdDocId, {
        level: 1,
        parent_id: null,
        blocks,
        returnOnlyIds: true
      })
      if (!(batchRes.code === 201 || batchRes.code === 200)) {
        ElMessage.warning(batchRes.message || '批量创建文档块失败')
        loadingDocGenarate.value = false
        return null
      }
    } catch (e) {
      loadingDocGenarate.value = false
      console.error('批量创建文档块异常:', e)
      ElMessage.warning('批量创建文档块失败，请稍后在编辑页重试')
      return null
    }
  }

  saveProjectData(finalDocumentName, createdDocId)
  loadingDocGenarate.value = false
  ElMessage.success(`文档"${finalDocumentName}"创建成功`)

  return { docId: createdDocId, docName: finalDocumentName }
}

// 文档创建 - 批量生成全部章节 (创建后在编辑器中进行)
const handleCreate = async () => {
  if (autoGenerateOnCreate.value) {
    // 创建文档后在新标签页中打开（编辑器会通过 URL 参数触发自动生成）
    const result = await finishDocumentWizard()
    if (result) {
      const url = router.resolve({
        name: 'Editor',
        params: { id: result.docId },
        query: { autoGenerate: 'true' }
      }).href
      window.open(url, '_blank')
      router.push('/home')
    }
  } else {
    const result = await finishDocumentWizard()
    if (result) {
      const url = router.resolve({ name: 'Editor', params: { id: result.docId } }).href
      window.open(url, '_blank')
      router.push('/home')
    }
  }
}

const cancelWizard = () => {
  router.push('/home')
}

// 初始化
onMounted(() => {
  loadWizardTags()
})
</script>

<template>
  <div class="create-page">
    <!-- 顶部导航栏 -->
    <header class="header">
      <div class="header-content">
        <div class="header-left">
          <HeaderLogo />
        </div>
        <div class="wizard-header-bar">
          <!-- <span class="wizard-header-title">新建文档</span> -->
          <div class="wizard-header-steps">
            <div
              v-for="(step, index) in wizardSteps"
              :key="step.id"
              class="step-item"
              :class="{
                'active': wizardStep === step.id,
                'completed': step.completed
              }"
            >
              <div class="step-icon">
                <el-icon v-if="step.completed">
                  <CircleCheck />
                </el-icon>
                <el-icon v-else-if="wizardStep === step.id">
                  <Check />
                </el-icon>
                <span v-else class="step-number">{{ step.id }}</span>
              </div>
              <div class="step-label">{{ step.title }}</div>
              <el-icon v-if="index < wizardSteps.length - 1" class="step-arrow">
                <ArrowRight />
              </el-icon>
            </div>
          </div>
        </div>
        <div class="header-right">
          <el-button @click="cancelWizard">取消</el-button>
        </div>
      </div>
    </header>

    <!-- 步骤内容 -->
    <div class="wizard-body">
      <div class="wizard-content">
        <!-- 步骤1: 文档关键信息 -->
        <div v-if="wizardStep === 1" class="step-content">

          <!-- 顶部：文档名称 -->
          <div class="core-section">
            <div class="core-title">
              <el-icon class="core-icon">
                <Document />
              </el-icon>
              <span>文档名称</span>
            </div>
            <el-form-item class="core-form-item">
              <el-input
                v-model="wizardForm.projectName"
                placeholder="请输入文档名称"
                maxlength="50"
                show-word-limit
                size="large"
                class="core-input"
                clearable
                autofocus
              />
            </el-form-item>
          </div>

          <!-- 两栏布局：左=项目信息输入  右=识别结果+标签 -->
          <div class="step1-grid">
            <!-- 左栏：项目信息输入 -->
            <div class="step1-left">
              <div class="panel-card">
                <div class="panel-header">
                  <h4 class="panel-title">项目信息</h4>
                  <el-button
                    type="primary"
                    :loading="recognizingProjectInfo"
                    :disabled="(!wizardForm.projectDescription?.trim() && uploadStatus !== 'success') || uploadStatus === 'uploading'"
                    @click="recognizeProjectInfo"
                    class="recognize-btn"
                    size="small"
                  >{{ recognizingProjectInfo ? '识别中...' : '识别' }}</el-button>
                </div>

                <div class="input-area-wrapper">
                  <el-input
                    v-model="wizardForm.projectDescription"
                    type="textarea"
                    :rows="12"
                    placeholder="请输入项目概况或上传项目相关文件（如设计说明、规划条件等）。点击识别后，系统能够识别各项关键信息（详见识别结果），以帮助您生成更准确的结果。

样例：本项目为&quot;XX高中教学楼、宿舍楼&quot;，位于XX市XX区，用地性质为教育用地；总建筑面积约10,000㎡，建筑高度50m，地上5层（地下1层）；结构体系为框架-剪力墙；抗震设防烈度7度；气候分区为夏热冬冷地区。"
                    maxlength="1200"
                    show-word-limit
                    resize="none"
                    class="project-desc-input"
                  />

                  <div class="input-toolbar">
                    <div class="toolbar-left">
                      <el-upload
                        ref="uploadRef"
                        class="upload-trigger-container"
                        :show-file-list="false"
                        :http-request="handleFileUpload"
                        :before-upload="beforeUpload"
                        :multiple="false"
                        :limit="1"
                        :on-exceed="handleExceed"
                        :disabled="recognizingProjectInfo"
                        accept=".jpg,.jpeg,.png,.pdf,.docx"
                      >
                        <el-button link type="primary" :disabled="recognizingProjectInfo" class="upload-btn-enhanced">
                          <template #icon><el-icon class="upload-icon-enhanced"><Paperclip /></el-icon></template>
                          上传文件或图片
                        </el-button>
                      </el-upload>
                      <el-tooltip content="支持图片(png/jpg/jpeg, 不超过1MB)和 文件(pdf/docx, 不超过2MB)" placement="top">
                        <el-icon class="upload-tip-icon"><QuestionFilled /></el-icon>
                      </el-tooltip>
                    </div>
                    <div class="toolbar-right">
                      <div v-if="uploadedFileName" class="uploaded-file-tag" :class="uploadStatus">
                        <el-icon class="file-icon"><Document /></el-icon>
                        <span class="file-name">{{ uploadedFileName }}</span>
                        <span v-if="uploadStepText" class="upload-step">{{ uploadStepText }}</span>
                        <el-icon v-if="uploadStatus === 'success'" class="status-icon success"><CircleCheck /></el-icon>
                        <el-icon v-if="uploadStatus === 'error'" class="status-icon error"><Close /></el-icon>
                        <el-icon v-if="uploadStatus !== 'uploading'" class="delete-icon" @click.stop="removeUploadedFile"><Delete /></el-icon>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 右栏：识别结果 + 标签选择 -->
            <div class="step1-right">
              <!-- 识别结果 -->
              <div class="panel-card">
                <div class="panel-header">
                  <h4 class="panel-title">识别结果</h4>
                  <el-button size="small" type="primary" @click="openReviewDrawer">详情</el-button>
                </div>
                <div class="overview-stats">
                  <el-tag type="success">识别 {{ recognitionResult.total }} 项</el-tag>
                  <el-tag type="info">已应用 {{ recognitionResult.applied }}</el-tag>
                  <el-tag type="warning" v-if="recognitionResult.pending">待确认 {{ recognitionResult.pending }}</el-tag>
                </div>
                <div class="section-stats">
                  <div class="section-stats-grid">
                    <el-tag
                      v-for="sec in sectionOrder"
                      :key="sec"
                      :type="(sectionCounts[sec]?.total || 0) > 0 && (sectionCounts[sec]?.recognized || 0) === (sectionCounts[sec]?.total || 0) ? 'success' : (sectionCounts[sec]?.recognized || 0) > 0 ? 'warning' : 'info'"
                    >
                      {{ sectionTitle(sec) }}：{{ sectionCounts[sec]?.recognized || 0 }}/{{ sectionCounts[sec]?.total || 0 }}
                    </el-tag>
                  </div>
                </div>
              </div>

              <!-- 标签选择 -->
              <div class="panel-card" v-if="wizardAllTags.length > 0">
                <div class="panel-header">
                  <h4 class="panel-title">标签选择</h4>
                  <el-tooltip content="选择标签可提升模板匹配精度" placement="top">
                    <el-icon class="panel-tip-icon"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </div>
                <div class="wizard-tag-groups">
                  <!-- 专业分类 -->
                  <div class="wizard-tag-group" v-if="wizardProfessionTags.length > 0">
                    <div class="wizard-tag-group-label">专业分类</div>
                    <div class="wizard-tag-grid">
                      <div
                        v-for="tag in wizardProfessionTags"
                        :key="tag.id"
                        class="wizard-chip"
                        :class="{ selected: wizardProfessionTagId === tag.id }"
                        @click="toggleWizardTag(tag.id, 'profession')"
                      >
                        <span class="chip-text">{{ tag.name }}</span>
                        <el-icon v-if="wizardProfessionTagId === tag.id" class="chip-check"><Check /></el-icon>
                      </div>
                      <div
                        v-if="!showCustomTagInput || customTagCategory !== 'profession'"
                        class="wizard-chip add-chip"
                        @click="startAddCustomTag('profession')"
                      >
                        <el-icon><Plus /></el-icon>
                        <span class="chip-text">自定义</span>
                      </div>
                      <div v-if="showCustomTagInput && customTagCategory === 'profession'" class="custom-tag-inline">
                        <el-input
                          v-model="customTagInput"
                          size="small"
                          placeholder="输入标签名"
                          maxlength="10"
                          autofocus
                          class="custom-tag-input"
                          @keydown.enter="addCustomTag"
                          @keydown.escape="cancelCustomTag"
                        />
                        <el-button size="small" type="primary" :disabled="!customTagInput.trim()" @click="addCustomTag">添加</el-button>
                        <el-button size="small" @click="cancelCustomTag">取消</el-button>
                      </div>
                    </div>
                  </div>
                  <!-- 业态分类 -->
                  <div class="wizard-tag-group" v-if="wizardBusinessTypeTags.length > 0">
                    <div class="wizard-tag-group-label">业态分类</div>
                    <div class="wizard-tag-grid">
                      <div
                        v-for="tag in wizardBusinessTypeTags"
                        :key="tag.id"
                        class="wizard-chip"
                        :class="{ selected: wizardBusinessTypeTagId === tag.id }"
                        @click="toggleWizardTag(tag.id, 'business_type')"
                      >
                        <span class="chip-text">{{ tag.name }}</span>
                        <el-icon v-if="wizardBusinessTypeTagId === tag.id" class="chip-check"><Check /></el-icon>
                      </div>
                      <div
                        v-if="!showCustomTagInput || customTagCategory !== 'business_type'"
                        class="wizard-chip add-chip"
                        @click="startAddCustomTag('business_type')"
                      >
                        <el-icon><Plus /></el-icon>
                        <span class="chip-text">自定义</span>
                      </div>
                      <div v-if="showCustomTagInput && customTagCategory === 'business_type'" class="custom-tag-inline">
                        <el-input
                          v-model="customTagInput"
                          size="small"
                          placeholder="输入标签名"
                          maxlength="10"
                          autofocus
                          class="custom-tag-input"
                          @keydown.enter="addCustomTag"
                          @keydown.escape="cancelCustomTag"
                        />
                        <el-button size="small" type="primary" :disabled="!customTagInput.trim()" @click="addCustomTag">添加</el-button>
                        <el-button size="small" @click="cancelCustomTag">取消</el-button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 步骤2: 大纲 -->
        <div v-if="wizardStep === 2" class="step-content step-content-outline">
          <div class="panel-card outline-panel">
            <div class="panel-header">
              <h4 class="panel-title">目录大纲</h4>
              <div class="outline-header-right">
                <span class="outline-hint">拖拽排序 / 点击标题修改 / 右侧按钮增删</span>
                <div class="outline-toggle">
                  <el-tooltip content="开启后，将通过AI自动生成全文" placement="top">
                    <span class="toggle-label">全文生成</span>
                  </el-tooltip>
                  <el-switch v-model="autoGenerateOnCreate" />
                </div>
              </div>
            </div>

            <div class="outline-list">
              <template v-for="(item, index) in outlineItems" :key="item.id">
                <div
                  class="outline-item"
                  draggable="true"
                  @dragstart="handleDragStart($event, index)"
                  @dragover="handleDragOver($event)"
                  @drop="handleDrop($event, index)"
                >
                  <div class="outline-item-content">
                    <div class="outline-left-actions">
                      <div class="drag-handle" title="拖拽排序">
                        <div class="three-dots">
                          <span></span><span></span><span></span>
                        </div>
                      </div>
                    </div>
                    <span class="outline-number">{{ getChineseNumber(index + 1) }}、</span>
                    <div
                      class="outline-title"
                      contenteditable="true"
                      @blur="updateOutlineTitle(item.id, ($event.target as HTMLElement).textContent || '')"
                      @keydown.enter.prevent="($event.target as HTMLElement).blur()"
                    >
                      {{ item.title }}
                    </div>
                    <div class="outline-right-actions">
                      <div
                        v-if="item.children && item.children.length > 0"
                        class="expand-btn"
                        @click="toggleOutlineExpand(item.id)"
                        :title="item.expanded ? '收起子节点' : '展开子节点'"
                      >
                        <el-icon :class="{ 'rotated': item.expanded }">
                          <ArrowRight />
                        </el-icon>
                      </div>
                      <div class="add-btn" @click="addOutlineItemAfter(index)" title="添加章节">
                        <el-icon><Plus /></el-icon>
                      </div>
                      <div class="delete-btn" @click="removeOutlineItem(item.id)" title="删除章节">
                        <el-icon><Close /></el-icon>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 子节点 -->
                <div
                  v-if="item.children && item.children.length > 0 && item.expanded"
                  class="sub-outline-container"
                >
                  <div
                    v-for="(subItem, subIndex) in item.children"
                    :key="subItem.id"
                    class="outline-item sub-outline-item"
                    draggable="true"
                    @dragstart="handleSubDragStart($event, Number(index), Number(subIndex))"
                    @dragover="handleDragOver($event)"
                    @drop="handleSubDrop($event, Number(index), Number(subIndex))"
                  >
                    <div class="outline-item-content">
                      <div class="outline-left-actions">
                        <div class="drag-handle" title="拖拽排序">
                          <div class="three-dots">
                            <span></span><span></span><span></span>
                          </div>
                        </div>
                      </div>
                      <span class="outline-number">{{ Number(index) + 1 }}.{{ Number(subIndex) + 1 }}</span>
                      <div
                        class="outline-title"
                        contenteditable="true"
                        @blur="updateSubOutlineTitle(item.id, subItem.id, ($event.target as HTMLElement).textContent || '')"
                        @keydown.enter.prevent="($event.target as HTMLElement).blur()"
                      >
                        {{ subItem.title }}
                      </div>
                      <div class="outline-right-actions">
                        <div class="add-btn" @click="addSubOutlineItemAfter(Number(index), Number(subIndex))" title="添加子章节">
                          <el-icon><Plus /></el-icon>
                        </div>
                        <div class="delete-btn" @click="removeSubOutlineItem(item.id, subItem.id)" title="删除子章节">
                          <el-icon><Close /></el-icon>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>

      <RecognizeResultDrawer v-model="showReviewDrawer" :wizardForm="wizardForm" :recognizedFields="recognizedFields" @clear-field="clearField" />
    </div>

    <!-- 底部按钮 -->
    <footer class="wizard-footer">
      <el-button @click="cancelWizard">取消</el-button>
      <div class="footer-right">
        <el-button
          v-if="wizardStep > 1"
          @click="prevWizardStep"
        >
          上一步
        </el-button>
        <el-button
          v-if="wizardStep < wizardSteps.length"
          type="primary"
          @click="nextWizardStep"
          :loading="loadingNextStep"
          :icon="ArrowRight"
          icon-position="right"
        >
          下一步
        </el-button>
        <el-button
          v-if="wizardStep === wizardSteps.length"
          type="primary"
          :icon="Star"
          :loading="loadingDocGenarate"
          @click="handleCreate"
        >
          确认创建
        </el-button>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.create-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
}

/* Header */
.header {
  background: linear-gradient(135deg, #ffffff 0%, #fafbfc 100%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  position: sticky;
  top: 0;
  z-index: 1000;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  height: 56px;
}

.header-left {
  display: flex;
  align-items: center;
}

.header-right {
  display: flex;
  align-items: center;
}

/* 向导头部步骤指示器 */
.wizard-header-bar {
  display: flex;
  align-items: center;
  gap: 20px;
}

.wizard-header-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--gray-900);
  white-space: nowrap;
}

.wizard-header-steps {
  display: flex;
  align-items: center;
  gap: 12px;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.step-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gray-200);
  color: var(--gray-500);
  font-size: 12px;
  font-weight: 600;
}

.step-item.active .step-icon {
  background: var(--primary-color);
  color: white;
}

.step-item.completed .step-icon {
  background: var(--success-color);
  color: white;
}

.step-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--gray-600);
}

.step-item.active .step-label {
  color: var(--primary-color);
  font-weight: 600;
}

.step-item.completed .step-label {
  color: var(--success-color);
}

.step-arrow {
  color: var(--gray-300);
  font-size: 14px;
}

/* 主体区域 */
.wizard-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
}

.wizard-content {
  max-width: 1100px;
  width: 100%;
  margin: 0 auto;
}

.step-content {
  max-width: 960px;
  width: 100%;
  margin: 0 auto;
}

/* 核心区域样式：文档名称 */
.core-section {
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: 12px;
  padding: 20px 24px;
  margin-bottom: 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  transition: all 0.3s ease;
}

.core-section:hover {
  border-color: var(--primary-color);
  box-shadow: 0 2px 12px rgba(64, 123, 255, 0.08);
}

.core-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}

.core-icon {
  font-size: 16px;
  color: var(--primary-color);
}

.core-form-item {
  margin-bottom: 0;
}

:deep(.core-input .el-input__wrapper) {
  background: #f8fafc;
  border: 1px solid var(--gray-300);
  border-radius: 8px;
  box-shadow: none;
  transition: all 0.3s ease;
}

:deep(.core-input .el-input__wrapper:hover) {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(64, 123, 255, 0.1);
}

:deep(.core-input .el-input__wrapper.is-focus) {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(64, 123, 255, 0.15);
}

:deep(.core-input .el-input__inner) {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

:deep(.core-input .el-input__count) {
  background: var(--gray-100);
  color: var(--gray-500);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 12px;
}

/* ========== 步骤1 两栏布局 ========== */
.step1-grid {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 20px;
  align-items: start;
}

.step1-left {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.step1-right {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

/* 统一面板卡片 */
.panel-card {
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  transition: all 0.3s ease;
}

.panel-card:hover {
  border-color: #c6d4e8;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.panel-title {
  font-weight: 600;
  font-size: 14px;
  color: #1f2937;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.panel-title::before {
  content: '';
  display: inline-block;
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: var(--primary-color);
}

.panel-tip-icon {
  display: flex;
  align-items: center;
  color: var(--gray-400);
  cursor: help;
  font-size: 16px;
  transition: color 0.2s;
}

.panel-tip-icon:hover {
  color: var(--primary-color);
}

/* 识别结果 */
.overview-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.section-stats {
  margin-top: 0;
}

.section-stats-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* Input Area & Toolbar */
.input-area-wrapper {
  border: 1px solid var(--gray-200);
  border-radius: 10px;
  padding: 1px;
  background: #f8fafc;
  transition: all 0.3s ease;
}

.input-area-wrapper:hover {
  border-color: var(--gray-400);
}

.input-area-wrapper:focus-within {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(64, 123, 255, 0.1);
}

.project-desc-input :deep(.el-textarea__inner) {
  border: none;
  box-shadow: none;
  padding: 14px;
  resize: none;
  background: transparent;
  min-height: 200px;
  height: clamp(200px, 30vh, 500px);
}

.input-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-top: 1px solid var(--gray-200);
  background: var(--gray-50);
  border-bottom-left-radius: var(--radius-md);
  border-bottom-right-radius: var(--radius-md);
  min-height: 40px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toolbar-left .upload-trigger-container {
  display: flex;
  align-items: center;
}

.toolbar-right {
  display: flex;
  align-items: center;
}

.upload-btn-enhanced {
  font-weight: 500;
}

.upload-icon-enhanced {
  font-size: 18px;
  font-weight: bold;
}

.upload-tip-icon {
  display: flex;
  align-items: center;
  color: var(--gray-400);
  cursor: help;
  font-size: 16px;
  transition: color 0.2s;
}

.upload-tip-icon:hover {
  color: var(--primary-color);
}

.uploaded-file-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: 4px;
  font-size: 12px;
  color: var(--gray-700);
  max-width: 450px;
}

.uploaded-file-tag .file-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.uploaded-file-tag.success {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #15803d;
}

.uploaded-file-tag.error {
  background: #fef2f2;
  border-color: #fecaca;
  color: #b91c1c;
}

.uploaded-file-tag.uploading {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
}

.file-icon {
  font-size: 14px;
}

.status-icon {
  font-size: 14px;
}
.status-icon.success { color: var(--success-color); }
.status-icon.error { color: var(--danger-color); }

.delete-icon {
  cursor: pointer;
  color: var(--gray-400);
  transition: color 0.2s;
  margin-left: 4px;
}
.delete-icon:hover {
  color: var(--danger-color);
}
.upload-step {
  color: var(--primary-color);
  font-size: 11px;
  white-space: nowrap;
}

/* 标签选择 */
.wizard-tag-groups {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.wizard-tag-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wizard-tag-group-label {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.wizard-tag-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.wizard-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
  background: #f1f5f9;
  border: 1px solid transparent;
  color: #475569;
}

.wizard-chip:hover {
  background: #e2e8f0;
  color: var(--primary-color);
}

.wizard-chip.selected {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border-color: transparent;
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);
}

.wizard-chip.selected:hover {
  opacity: 0.92;
  color: #ffffff;
}

.chip-check {
  font-size: 11px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.25);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.chip-text {
  line-height: 1;
  font-weight: 500;
}

.wizard-chip.add-chip {
  border: 1.5px dashed #cbd5e1;
  color: #94a3b8;
  background: transparent;
}

.wizard-chip.add-chip:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
  background: rgba(59, 130, 246, 0.04);
}

.custom-tag-inline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #ffffff;
  border: 1.5px dashed #cbd5e1;
  padding: 3px 8px;
  border-radius: 8px;
}

.custom-tag-input {
  width: 110px;
}

.custom-tag-input :deep(.el-input__wrapper) {
  border-radius: 6px;
  box-shadow: none;
  height: 26px;
  padding: 0 8px;
}

.custom-tag-inline :deep(.el-button) {
  height: 26px;
  padding: 0 10px;
  border-radius: 6px;
}

/* ========== 步骤2: 大纲 ========== */
.step-content-outline {
  display: flex;
  flex-direction: column;
  max-width: 100%;
}

.outline-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  /* 填满可用空间，减去 header(56) + body-padding(48+28) + footer(56) + card-padding(40) + header间距 */
  max-height: calc(100vh - 230px);
}

.outline-panel .panel-header {
  flex-shrink: 0;
  margin-bottom: 0;
  padding-bottom: 14px;
  border-bottom: 1px solid #f1f5f9;
}

.outline-header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.outline-hint {
  font-size: 12px;
  color: #94a3b8;
}

.outline-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toggle-label {
  font-size: 13px;
  color: var(--gray-700);
  white-space: nowrap;
}

/* 大纲列表 */
.outline-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 4px 4px;
  scrollbar-width: thin;
  scrollbar-color: #e2e8f0 transparent;
}

.outline-list::-webkit-scrollbar {
  width: 5px;
}

.outline-list::-webkit-scrollbar-track {
  background: transparent;
}

.outline-list::-webkit-scrollbar-thumb {
  background-color: #e2e8f0;
  border-radius: 3px;
}

.outline-list::-webkit-scrollbar-thumb:hover {
  background-color: #cbd5e1;
}

.outline-item {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  margin-bottom: 6px;
  transition: all 0.2s ease;
}

.outline-item:hover {
  border-color: #93c5fd;
  background: #f0f7ff;
  box-shadow: 0 1px 4px rgba(59, 130, 246, 0.08);
}

.outline-item-content {
  display: flex;
  align-items: center;
  padding: 8px 14px;
  gap: 8px;
}

.outline-left-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.outline-right-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
  flex-shrink: 0;
  opacity: 0.4;
  transition: opacity 0.2s ease;
}

.outline-item:hover .outline-right-actions {
  opacity: 1;
}

.outline-number {
  font-weight: 700;
  color: #3b82f6;
  min-width: 32px;
  font-size: 14px;
  flex-shrink: 0;
}

.outline-title {
  flex: 1;
  font-size: 14px;
  color: #1e293b;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s ease;
  min-height: 24px;
  line-height: 1.5;
}

.outline-title:hover {
  background: rgba(255, 255, 255, 0.7);
}

.outline-title:focus {
  outline: 2px solid #3b82f6;
  outline-offset: -1px;
  background: white;
}

.add-btn, .delete-btn, .drag-handle, .expand-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  color: #94a3b8;
}

.add-btn:hover {
  background: #dcfce7;
  color: #16a34a;
}

.delete-btn:hover {
  background: #fee2e2;
  color: #dc2626;
}

.drag-handle {
  cursor: grab;
  color: #cbd5e1;
}

.drag-handle:hover {
  background: #f1f5f9;
  color: #64748b;
}

.drag-handle:active {
  cursor: grabbing;
}

.expand-btn:hover {
  background: #dbeafe;
  color: #3b82f6;
}

.expand-btn .el-icon {
  transition: transform 0.2s ease;
}

.expand-btn .el-icon.rotated {
  transform: rotate(90deg);
}

.sub-outline-container {
  margin-left: 36px;
  margin-bottom: 6px;
  border-left: 2px solid #e2e8f0;
  padding-left: 12px;
}

.sub-outline-item {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-bottom: 4px;
}

.sub-outline-item:hover {
  border-color: #93c5fd;
  background: #f8fafc;
}

.sub-outline-item .outline-number {
  color: #64748b;
  font-size: 13px;
  min-width: 40px;
  font-weight: 600;
}

.sub-outline-item .outline-title {
  font-size: 13px;
  color: #475569;
}

.sub-outline-item .outline-item-content {
  padding: 6px 12px;
}

.three-dots {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 12px;
  height: 16px;
}

.three-dots span {
  width: 3px;
  height: 3px;
  background-color: currentColor;
  border-radius: 50%;
  display: block;
}

/* 底部按钮 */
.wizard-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 32px;
  border-top: 1px solid var(--gray-200);
  background: white;
}

.footer-right {
  display: flex;
  gap: 8px;
}

/* ================================
   Responsive Breakpoints
   ================================ */

/* Large desktops (1440px+) */
@media (min-width: 1440px) {
  .wizard-content {
    max-width: 1200px;
  }
  .step-content {
    max-width: 1100px;
  }
  .step1-grid {
    grid-template-columns: 1fr 420px;
    gap: 24px;
  }
  .wizard-body {
    padding: 28px 48px;
  }
}

/* Medium desktops (≤1279px) - stack to single column */
@media (max-width: 1279px) {
  .wizard-content {
    max-width: 900px;
  }
  .step-content {
    max-width: 840px;
  }
  .step1-grid {
    grid-template-columns: 1fr 340px;
  }
}

/* Small desktops (≤1023px) - single column */
@media (max-width: 1023px) {
  .wizard-content {
    max-width: 100%;
  }
  .step-content {
    max-width: 100%;
  }
  .step1-grid {
    grid-template-columns: 1fr;
  }
  .wizard-body {
    padding: 16px;
  }
  .wizard-footer {
    padding: 14px 16px;
  }
  .project-desc-input :deep(.el-textarea__inner) {
    height: clamp(160px, 20vh, 300px);
  }
  .outline-header-right {
    gap: 12px;
  }
  .outline-hint {
    display: none;
  }
}

/* Mobile (≤767px) */
@media (max-width: 767px) {
  .header-content {
    padding: 0 12px;
    height: 48px;
  }
  .wizard-body {
    padding: 12px;
  }
  .wizard-footer {
    padding: 12px 16px;
  }
  .core-section {
    padding: 14px;
  }
  .panel-card {
    padding: 14px;
  }
  .outline-panel .panel-header {
    flex-wrap: wrap;
    gap: 8px;
  }
  .outline-header-right {
    width: 100%;
    justify-content: flex-end;
  }
  .outline-list {
    max-height: calc(100vh - 200px);
    padding: 8px;
  }
  .sub-outline-container {
    margin-left: 20px;
    padding-left: 8px;
  }
  .project-desc-input :deep(.el-textarea__inner) {
    height: clamp(140px, 18vh, 250px);
  }
  .input-toolbar {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  .toolbar-right {
    width: 100%;
  }
  .uploaded-file-tag {
    max-width: 100%;
  }
}
</style>
