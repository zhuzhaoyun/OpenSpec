<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElNotification, ElMessage, ElMessageBox, ElCollapseTransition } from 'element-plus'
import {
  Plus,
  Setting,
  Document,
  ArrowRight,
  MagicStick
} from '@element-plus/icons-vue'
import AppHeader from '../components/AppHeader.vue'
import DocumentOutline from '../components/DocumentOutline.vue'
import MarkdownEditor from '../components/MarkdownEditor.vue'
import ChatAssistant from '../components/ChatAssistant.vue'
import {
  type ProjectInfo,
  promptParamsByTitle
} from '../data/mockData'
import { useOperationRecord } from '../composables/useOperationRecord'
import { listOperationRecords, clearOperationRecords, ACTION_TYPE_LABELS, type OperationRecord } from '../service/operationRecord'

import { parse2Json, parseSecondaryHeadings } from '../utils/convert'
import { downloadFile } from '../utils/document'

import { getDocumentBlocks, getDocumentBlockDetail, updateDocumentBlock, exportDocumentMarkdown, getDocumentById } from '../service/document'
import { importToAutoCAD } from '../service/localCad'
import { generateParagraphBatch } from '../service/ragflow'
import { resetProjectForm } from '../utils/common'
import { authStorage } from '../utils/auth'
import { hasTemplateManagementLicense } from '../service/license'
import { getAllTags, searchTemplateChapter, type TemplateTag } from '../service/template'

const route = useRoute()
const router = useRouter()

const userInfo = computed(() => authStorage.getUserInfo())
const userId = computed(() => {
  const info = userInfo.value
  return info?.id || ''
})

// 处理用户下拉菜单命令（logout 由 AppHeader 统一处理）
const handleUserCommand = async (command: string) => {
  if (command === 'settings') {
    const hasLicense = await hasTemplateManagementLicense()
    if (hasLicense) {
      router.push('/settings')
    } else {
      ElMessageBox.alert(
        '模板管理功能需要企业版授权，请联系我们升级到企业版。',
        '升级到企业版',
        {
          confirmButtonText: '我知道了',
          type: 'warning'
        }
      )
    }
  }
}

// 响应式数据
const documentTitle = ref('')
const isModified = ref(false)

// 项目信息表单数据
const projectForm = ref<ProjectInfo>(resetProjectForm())

// AI配置相关
const showConfigPanel = ref(false)
const chatAssistantWidth = ref(380)

const handleChatResize = (newWidth: number) => {
  chatAssistantWidth.value = Math.max(300, Math.min(newWidth, 800))
}

const isResizingChat = ref(false)

const editorContainerStyle = computed(() => ({
  '--chat-width': `${chatAssistantWidth.value}px`
}))

const isOutlineCollapsed = ref(false)
const currentDocumentId = ref('')
const currentBlockContent = ref('')
const currentBlockId = ref('')
const isServerDoc = computed(() => !!currentDocumentId.value)
const inGenerating = ref(false)
const showCitation = ref(false)  // 引用标记显示开关（从 ChatAssistant 同步）

const abortGenerate = () => {
  inGenerating.value = false
}

// 章节数据
const chapters = ref<any[]>([])
const currentChapterId = ref('')

// 引用资料折叠状态
const isReferenceMaterialsExpanded = ref(false)
const activeBottomTab = ref<'reference' | 'operation'>('reference')

// 操作记录
const { record: recordOperation } = useOperationRecord(currentDocumentId)
const operationRecords = ref<OperationRecord[]>([])
const contentBeforeEdit = ref('')  // 记录AI生成的原始内容，用于后续diff

const loadOperationRecords = async () => {
  if (!currentDocumentId.value) return
  operationRecords.value = await listOperationRecords({
    document_id: currentDocumentId.value,
    limit: 50,
  })
}

const handleClearRecords = async () => {
  if (!currentDocumentId.value) return
  try {
    await ElMessageBox.confirm('确定清空当前文档的所有操作记录？', '清空操作记录', {
      type: 'warning',
      confirmButtonText: '清空',
      cancelButtonText: '取消',
    })
    const ok = await clearOperationRecords(currentDocumentId.value)
    if (ok) {
      operationRecords.value = []
      ElMessage.success('操作记录已清空')
    } else {
      ElMessage.error('清空失败')
    }
  } catch {}
}

// 处理章节点击事件
const handleChapterClick = async (chapterId: string) => {
  if (inGenerating.value) {
    try {
      await ElMessageBox.confirm(
        '当前正在生成内容，切换章节将中断生成。是否继续？',
        '确认切换',
        {
          type: 'warning',
          confirmButtonText: '中断并切换',
          cancelButtonText: '取消'
        }
      )
      abortGenerate()
    } catch {
      ElMessage.info('已取消切换，继续生成当前内容')
      return
    }
  }

  currentChapterId.value = chapterId
  scrollToChapter(chapterId)
  try {
    const chapter = chapters.value.find(ch => ch.id === chapterId)
    recordOperation('chapter_switched', chapter?.title, `切换到章节: ${chapter?.title || chapterId}`)
    const blockId = chapter && (chapter as any).blockId
    if (currentDocumentId.value && blockId) {
      currentBlockId.value = String(blockId)
      const res = await getDocumentBlockDetail(currentDocumentId.value, String(blockId))
      if (res.code === 200 && res.data) {
        currentBlockContent.value = res.data.content || ''
        updateCurrentChapterSecondaryHeadings()
      }
    }
  } catch (e) {
    console.error('获取文档块内容失败:', e)
  }
}

const handleChapterCollapse = (chapterId: string, collapsed: boolean) => {
  const chapter = chapters.value.find(ch => ch.id === chapterId)
  if (chapter) {
    chapter.collapsed = collapsed
  }
}

const handleOutlineToggle = (collapsed: boolean) => {
  isOutlineCollapsed.value = collapsed
}

// 加载文档大纲
const totalDocObjects = ref<any[]>([])

const loadDocumentOutline = async (documentId: string) => {
  try {
    const res = await getDocumentBlocks(documentId, { page: 1, pageSize: 1000, blockType: 'heading_1' })
    if (res.code === 200 && res.data) {
      const list = res.data.list || []

      const mapped = await Promise.all(
        list.map(async (blk: any, idx: number) => {
          const titleFromBlockName = (blk.blockName || '').toString().trim()
          const firstLine = (blk.content || '').split('\n')[0] || ''
          const title = titleFromBlockName || firstLine.replace(/^#+\s*/, '') || `章节 ${idx + 1}`

          let children: Array<{ id: string, title: string }> = []
          let contentToParse = blk.content || ''

          if (!contentToParse && blk.id) {
            try {
              const detailRes = await getDocumentBlockDetail(documentId, String(blk.id))
              if (detailRes.code === 200 && detailRes.data && detailRes.data.content) {
                contentToParse = detailRes.data.content
              }
            } catch (e) {
              console.warn(`加载章节 ${idx + 1} 内容失败:`, e)
            }
          }

          const chapterId = String(idx + 1)
          if (contentToParse) {
            children = parseSecondaryHeadings(contentToParse, chapterId)
          }

          const parsedDocReference = blk.docReference ? parse2Json(blk.docReference) : []
          const parsedChunkReference = blk.chunkReference ? parse2Json(blk.chunkReference) : []

          return {
            id: chapterId,
            title,
            active: idx === 0,
            collapsed: false,
            blockId: blk.id,
            children: children.length > 0 ? children : undefined,
            docReference: parsedDocReference,
            chunkReference: parsedChunkReference
          }
        })
      )

      chapters.value = mapped
      const newDocObjects = mapped.map((ch: any) => ({
        id: Number(ch.id),
        chapterId: `chapter-${ch.id}`,
        type: 'chapter',
        title: ch.title,
        hasContent: false,
        loading: false,
        actions: ['generate'],
        children: (ch.children || []).map((sub: any) => ({
          id: sub.id,
          title: sub.title,
          paragraphs: []
        })),
        paragraphs: [],
        docReference: Array.isArray(ch.docReference) ? ch.docReference : (ch.docReference ? parse2Json(ch.docReference) : []),
        chunkReference: Array.isArray(ch.chunkReference) ? ch.chunkReference : (ch.chunkReference ? parse2Json(ch.chunkReference) : [])
      }))
      totalDocObjects.value = newDocObjects

      if (newDocObjects.length > 0) currentChapterId.value = newDocObjects[0]?.id.toString()
      const blockId = mapped[0]?.blockId || ''
      if (mapped.length > 0 && blockId) {
        currentBlockId.value = String(blockId)
        const resDetail = await getDocumentBlockDetail(documentId, String(blockId))
        if (resDetail.code === 200 && resDetail.data) {
          currentBlockContent.value = resDetail.data.content || ''
        }
      }
    }
  } catch (e) {
    console.error('加载文档大纲失败:', e)
  }
}

const toggleReferenceMaterials = () => {
  isReferenceMaterialsExpanded.value = !isReferenceMaterialsExpanded.value
}

// 标签缓存
const allTagsCache = ref<TemplateTag[]>([])
const loadAllTagsCache = async () => {
  try {
    const response = await getAllTags()
    if (response.code === 200 && response.data) {
      allTagsCache.value = response.data
    }
  } catch (error) {
    console.error('加载标签缓存失败:', error)
  }
}

const activeDocTagLabels = computed(() => {
  const labels: Array<{ name: string; type: string }> = []
  const info = projectForm.value
  const tags = allTagsCache.value

  if (info.professionTagId) {
    const tag = tags.find(t => t.id === info.professionTagId)
    if (tag) labels.push({ name: tag.name, type: 'primary' })
  }
  if (info.businessTypeTagId) {
    const tag = tags.find(t => t.id === info.businessTypeTagId)
    if (tag) labels.push({ name: tag.name, type: 'warning' })
  }
  return labels
})

// 文档标签编辑 popover
const showDocTagPopover = ref(false)
const editProfessionTagId = ref<number | null>(null)
const editBusinessTypeTagId = ref<number | null>(null)

const cachedProfessionTags = computed(() =>
  allTagsCache.value.filter(t => t.category === 'profession')
)
const cachedBusinessTypeTags = computed(() =>
  allTagsCache.value.filter(t => t.category === 'business_type')
)

const openDocTagPopover = () => {
  const info = projectForm.value
  editProfessionTagId.value = info.professionTagId ?? null
  editBusinessTypeTagId.value = info.businessTypeTagId ?? null
  showDocTagPopover.value = true
}

const toggleEditTag = (tagId: number, category: 'profession' | 'business_type') => {
  if (category === 'profession') {
    editProfessionTagId.value = editProfessionTagId.value === tagId ? null : tagId
  } else {
    editBusinessTypeTagId.value = editBusinessTypeTagId.value === tagId ? null : tagId
  }
}

const saveDocTags = () => {
  projectForm.value.professionTagId = editProfessionTagId.value ?? undefined
  projectForm.value.businessTypeTagId = editBusinessTypeTagId.value ?? undefined
  saveProjectInfo()
  showDocTagPopover.value = false
}

// 保存/导出
const saveDocument = async () => {
  if (isServerDoc.value && currentBlockContent.value) {
    await saveMarkdownContent(currentBlockContent.value)
    return
  }

  setTimeout(() => {
    isModified.value = false
    showNotification('文档已保存', 'success')
  }, 500)
}

const exportDocument = async (format: string) => {
  const targetDocId = currentDocumentId.value
  if (!targetDocId) {
    ElMessage.warning('请先选择要导出的文档')
    return
  }

  const docName = documentTitle.value || '当前文档'

  switch(format) {
    case 'md': {
      showNotification(`正在导出"${docName}"为Markdown文件...`, 'info')
      try {
        const response = await exportDocumentMarkdown(targetDocId)
        if (response.code === 200 && response.data) {
          const { content, fileName } = response.data
          downloadFile(content, fileName, 'text/markdown')
          showNotification(`"${docName}"导出成功！`, 'success')
        } else {
          throw new Error(response.message || '导出失败')
        }
      } catch (error) {
        console.error('导出 Markdown 失败:', error)
        ElMessage.error(error instanceof Error ? error.message : '导出 Markdown 失败，请稍后重试')
      }
      break
    }
    case 'cad': {
      showNotification(`正在将"${docName}"导入到AutoCAD...`, 'info')
      try {
        const response = await exportDocumentMarkdown(targetDocId)
        if (response.code === 200 && response.data) {
          const { content } = response.data
          const cadResponse = await importToAutoCAD({
            markdown: content,
            template: {
              blockName: "A1_TemplateBlock",
              dwgUrl: "https://zspt-prod.oss-cn-guangzhou.aliyuncs.com/A1_TemplateBlock_dby.dwg"
            },
            options: { clearExisting: true }
          })
          if (cadResponse.success) {
            showNotification(`"${docName}"已发送至AutoCAD！`, 'success')
          } else {
            throw new Error(cadResponse.message || '导入AutoCAD失败')
          }
        } else {
          throw new Error(response.message || '获取文档内容失败')
        }
      } catch (error) {
        console.error('导入 AutoCAD 失败:', error)
        ElMessage.error(error instanceof Error ? error.message : '导入 AutoCAD 失败，请检查插件是否运行')
      }
      break
    }
  }
}

const scrollToChapter = (chapterId: string) => {
  chapters.value.forEach(chapter => {
    chapter.active = chapter.id === chapterId
  })
}

const findChapterById = (chapters: any[], targetId: any): any => {
  for (const chapter of chapters) {
    if (chapter.id.toString() === targetId.toString()) {
      return chapter
    }
    if (chapter.children && chapter.children.length > 0) {
      const found = findChapterById(chapter.children, targetId)
      if (found) return found
    }
  }
  return null
}

const currentChapter = computed(() => {
  if (!currentChapterId.value && totalDocObjects.value.length > 0) {
    currentChapterId.value = totalDocObjects.value[0]?.id?.toString() || ''
  }
  if (!currentChapterId.value) return null
  return findChapterById(totalDocObjects.value, currentChapterId.value)
})

const switchGenConfig = () => {
  showConfigPanel.value = !showConfigPanel.value
}

const handleContentStreaming = (content: string) => {
  currentBlockContent.value = content
}

const handleContentGenerated = (content: string, chunkRef?: any[], docAggs?: any[]) => {
  if (content && content.trim()) {
    contentBeforeEdit.value = content
    currentBlockContent.value = content

    // 将引用元数据存入当前章节
    if (currentChapter.value) {
      if (chunkRef && chunkRef.length > 0) {
        currentChapter.value.chunkReference = chunkRef
      }
      if (docAggs && docAggs.length > 0) {
        currentChapter.value.docReference = docAggs
      }
    }

    markAsModified()
    updateCurrentChapterSecondaryHeadings()
    ElMessage.success('AI 生成内容已应用到编辑器')
    recordOperation('content_generated', currentChapter.value?.title, 'AI生成内容已应用', {
      content_length: content.length,
    })
  }
}

const showNotification = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
  ElNotification({
    title: '提示',
    message,
    type,
    duration: 3000
  })
}

const markAsModified = () => {
  isModified.value = true
}

const saveMarkdownContent = async (content: string) => {
  if (!currentDocumentId.value || !currentBlockId.value) {
    ElMessage.warning('文档ID或块ID不存在，无法保存')
    return
  }

  try {
    const res = await updateDocumentBlock(
      currentDocumentId.value,
      currentBlockId.value,
      {
        block_name: currentChapter.value.title,
        content,
        docReference: currentChapter.value.docReference,
        chunkReference: currentChapter.value.chunkReference
      }
    )

    if (res.code === 200) {
      isModified.value = false
      showNotification('文档已保存', 'success')
      recordOperation('content_saved', currentChapter.value?.title, '保存了章节内容', {
        content_length: content.length,
        has_ai_generated: !!contentBeforeEdit.value,
      })
    } else {
      ElMessage.error(res.message || '保存失败')
    }
  } catch (error) {
    console.error('保存 Markdown 内容失败:', error)
    ElMessage.error('保存失败，请稍后重试')
  }
}

const handleMarkdownUpdate = () => {
  markAsModified()
  updateCurrentChapterSecondaryHeadings()
}

const updateCurrentChapterSecondaryHeadings = () => {
  if (!isServerDoc.value || !currentChapterId.value) return

  const chapter = chapters.value.find(ch => ch.id === currentChapterId.value)
  if (chapter && currentBlockContent.value) {
    const secondaryHeadings = parseSecondaryHeadings(currentBlockContent.value, currentChapterId.value)
    if (secondaryHeadings.length > 0) {
      chapter.children = secondaryHeadings
    } else {
      chapter.children = undefined
    }

    const docObject = totalDocObjects.value.find(obj => obj.chapterId === `chapter-${currentChapterId.value}`)
    if (docObject) {
      docObject.children = secondaryHeadings.map((sub: any) => ({
        id: sub.id,
        title: sub.title,
        paragraphs: []
      }))
    }
  }
}

const updateDocumentTitle = (newTitle: string) => {
  documentTitle.value = newTitle
  markAsModified()
}

// 项目信息摘要
// const projectSummary = computed(() => {
//   const form = projectForm.value
//   if (!form.projectName && !form.buildingArea && !form.buildingHeight) {
//     return ''
//   }

//   const parts = []
//   if (form.projectName) parts.push(form.projectName)
//   if (form.buildingArea) parts.push(`建筑面积${form.buildingArea}㎡`)
//   if (form.buildingHeight) parts.push(`建筑高度${form.buildingHeight}m`)
//   if (form.floors) {
//     const floorText = form.undergroundFloors
//       ? `地上${form.floors}层/地下${form.undergroundFloors}层`
//       : `${form.floors}层`
//     parts.push(floorText)
//   }
//   return parts.join(' | ')
// })

// 保存/加载项目信息
const saveProjectInfoTimer = ref<ReturnType<typeof setTimeout> | null>(null)

const saveProjectInfo = () => {
  try {
    const projectData = {
      ...projectForm.value,
      documentTitle: documentTitle.value,
      lastUpdated: new Date().toISOString(),
      documentId: currentDocumentId.value || 'default'
    }
    const storageKey = `project_info_${projectData.documentId}`
    localStorage.setItem(storageKey, JSON.stringify(projectData))

    // 清理过期的项目信息缓存（保留最近30天）
    cleanupOldProjectInfo()
  } catch (error) {
    console.error('保存项目信息失败:', error)
  }
}

// 清理旧的项目信息缓存，保留最近30天的数据
const cleanupOldProjectInfo = () => {
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('project_info_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}')
          const lastUpdated = data.lastUpdated ? new Date(data.lastUpdated) : null
          if (lastUpdated && lastUpdated < thirtyDaysAgo) {
            keysToRemove.push(key)
          }
        } catch {
          // 解析失败，删除无效数据
          keysToRemove.push(key)
        }
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key))
    if (keysToRemove.length > 0) {
      console.log(`清理了 ${keysToRemove.length} 个过期的项目信息缓存`)
    }
  } catch (error) {
    console.error('清理过期缓存失败:', error)
  }
}

const loadProjectInfo = (documentId: string) => {
  try {
    const storageKey = `project_info_${documentId}`
    const savedData = localStorage.getItem(storageKey)

    if (savedData) {
      const projectData = JSON.parse(savedData)
      projectForm.value = {
        ...projectForm.value,
        ...projectData
      }
      // 同时加载标题（如果存在）
      if (projectData.documentTitle) {
        documentTitle.value = projectData.documentTitle
      }
      return true
    }
  } catch (error) {
    console.error('加载项目信息失败:', error)
  }
  return false
}

// ========== 批量生成（从 CreateDocument 创建后通过 URL 参数触发） ==========
const chapterGenerationStatus = ref<Record<string, { status: 'pending' | 'generating' | 'done' | 'error'; progress: number; message?: string; updatedAt?: number }>>({})
const MAX_CONCURRENCY = 5

const runWithConcurrency = async <T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  limit: number
): Promise<R[]> => {
  const results: R[] = new Array(items.length)
  let nextIndex = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = nextIndex++
      if (idx >= items.length) break
      results[idx] = await worker(items[idx], idx)
    }
  })
  await Promise.all(workers)
  return results
}

const extractGeneratedContent = (resp: any) => {
  if (!resp) return ''
  const d = resp.data
  if (typeof d === 'string') return d
  if (d && typeof d === 'object') {
    if (typeof d.text === 'string') return d.text
    if (typeof d.content === 'string') return d.content
  }
  if (Array.isArray(d)) {
    return d.map((it: any) => (typeof it === 'string' ? it : (it?.content || it?.text || ''))).join('\n')
  }
  return ''
}

const generateDocumentDefault = async () => {
  if (!userId.value) {
    ElMessage.error('无法获取用户信息，请重新登录')
    console.error('userId is empty, cannot generate document')
    return
  }

  const allItems = chapters.value
  if (!allItems || allItems.length === 0) return

  const indices = Array.from({ length: allItems.length }, (_, i) => i)
  await runWithConcurrency(indices, async (index) => {
    const idx = index as number
    const item: any = allItems[idx]
    const chapterId = String(item.id || idx + 1)
    chapterGenerationStatus.value[chapterId] = { status: 'generating', progress: 0, updatedAt: Date.now() }

    const titleStr = String(item.title || '').trim()
    const chapterName = `${chapterId}.${titleStr}`

    const titles = (item?.children || []).map((sub: any) => String(sub.title || '').trim()).filter((t: string) => !!t)
    const query = titles.length > 0 ? `生成章节，包括 ${titles.join(';\n')}.` : '生成章节。'
    const docObject = totalDocObjects.value.find((o: any) => String(o.title || '') === titleStr)
    if (docObject) {
      docObject.loading = true
    }

    try {
      const promptParams: any = (promptParamsByTitle as any)[titleStr] || {}
      const usePromptParams = !!(promptParams && (promptParams.structure || promptParams.feature || promptParams.requirement))

      let matchedTemplate = ''
      try {
        const matchResult = await searchTemplateChapter({
          userId: String(userInfo.value?.id || ''),
          chapterTitle: titleStr,
          professionTagId: projectForm.value.professionTagId,
          businessTypeTagId: projectForm.value.businessTypeTagId,
          threshold: 0.5,
          limit: 1
        })
        if (matchResult.code === 200 && matchResult.data?.matched) {
          matchedTemplate = matchResult.data.matched.chunkContent || ''
        }
      } catch (matchError) {
        console.warn(`章节"${titleStr}" 模板匹配失败:`, matchError)
      }

      const params: any = {
        query,
        title: documentTitle.value,
        requirement: '',
        structure: '',
        feature: '',
        chapterName,
        addition: '',
        template: matchedTemplate,
        usePromptParams,
        document_id: currentDocumentId.value,
        user_id: userId.value,
        professionTagId: projectForm.value.professionTagId,
        businessTypeTagId: projectForm.value.businessTypeTagId,
      }

      if (usePromptParams) {
        params.structure = String(promptParams.structure || '')
        params.feature = String(promptParams.feature || '')
        params.requirement = String(promptParams.requirement || '')
      }

      const resp = await generateParagraphBatch(params)
      const content = extractGeneratedContent(resp)
      const docRefRaw = resp?.data?.doc_reference || null
      const chkRefRaw = resp?.data?.chunk_reference || null

      if (String(item?.id) === String(currentChapterId.value)) {
        currentBlockContent.value = content || ''
        updateCurrentChapterSecondaryHeadings()
      }
      if (docObject) {
        docObject.docReference = docRefRaw || []
        docObject.chunkReference = chkRefRaw || []
      }

      const blockName = String(item.title || '').trim()
      const targetChapter = chapters.value.find((ch: any) => String(ch.id) === chapterId)
      if (targetChapter && targetChapter.blockId) {
        await updateDocumentBlock(
          currentDocumentId.value,
          String(targetChapter.blockId),
          {
            block_name: blockName,
            content,
            docReference: docRefRaw || [],
            chunkReference: chkRefRaw || []
          }
        )
      }
      chapterGenerationStatus.value[chapterId] = { status: 'done', progress: 100, updatedAt: Date.now() }
      return { block_name: blockName, content }
    } catch (e: any) {
      const obj = totalDocObjects.value.find((o: any) => String(o.title || '') === String(item.title || '').trim())
      if (obj) obj.loading = false
      chapterGenerationStatus.value[chapterId] = { status: 'error', progress: 0, message: String(e?.message || ''), updatedAt: Date.now() }
      return { block_name: String(item.title || '').trim(), content: '' }
    }
  }, MAX_CONCURRENCY)

  chapterGenerationStatus.value = {}
  recordOperation('batch_generated', undefined, '一键生成全部章节', {
    chapter_count: allItems.length,
  })
}

// 生命周期
onMounted(async () => {
  loadAllTagsCache()

  const documentId = route.params.id as string
  if (!documentId) {
    // 没有文档ID，跳转回主页
    router.push('/home')
    return
  }

  currentDocumentId.value = documentId

  // 尝试从 localStorage 加载当前文档特定的项目信息
  const hasLocalProjectInfo = loadProjectInfo(documentId)

  // 检查 currentProject（仅用于新创建文档的临时数据传递）
  // 使用 sessionStorage 实现标签页隔离，避免多文档窗口间的数据竞争
  const projectData = sessionStorage.getItem('currentProject')
  let hasCurrentProjectData = false
  if (projectData && !hasLocalProjectInfo) {
    try {
      const project = JSON.parse(projectData)
      // 只有当 currentProject 属于当前文档时才使用
      if (project.documentId === documentId) {
        documentTitle.value = project.title || '施工设计说明'
        hasCurrentProjectData = true
        // 填充项目概况信息到 projectForm
        if (project.projectInfo) {
          projectForm.value = {
            ...projectForm.value,
            ...project.projectInfo
          }
        }
        // 使用完毕后清除 currentProject
        sessionStorage.removeItem('currentProject')
      }
    } catch {}
  }

  // 加载文档大纲
  await loadDocumentOutline(documentId)

  // 如果本地没有数据（既不是本地缓存也不是 currentProject），从后端 API 获取
  if (!hasLocalProjectInfo && !hasCurrentProjectData) {
    try {
      const result = await getDocumentById(documentId)
      if (result.code === 200 && result.data) {
        const doc = result.data
        documentTitle.value = doc.name || '施工设计说明'
        // 解析 projectInfo
        try {
          let tempInfo = typeof doc.projectInfo === 'string' ? JSON.parse(doc.projectInfo) : doc.projectInfo
          if (tempInfo && typeof tempInfo === 'object' && tempInfo.projectInfo) {
            tempInfo = tempInfo.projectInfo
          }
          if (tempInfo) {
            projectForm.value = {
              ...projectForm.value,
              ...tempInfo
            }
          }
        } catch {}
      }
    } catch {}
  } else if (!documentTitle.value) {
    // 有本地表单数据但没有标题，从后端获取标题（不覆盖表单数据）
    try {
      const result = await getDocumentById(documentId)
      if (result.code === 200 && result.data) {
        documentTitle.value = result.data.name || '施工设计说明'
      }
    } catch {}
  }

  showConfigPanel.value = true

  // 检查是否需要自动生成全文
  if (route.query.autoGenerate === 'true') {
    // 立即移除 URL 中的 autoGenerate 参数，防止刷新页面时重复触发
    const { autoGenerate, ...restQuery } = route.query
    router.replace({ query: restQuery })
    generateDocumentDefault()
  }

  // 自动保存
  setInterval(() => {
    if (isModified.value) {
      console.log('自动保存...')
      isModified.value = false
    }
  }, 30000)

  // 加载操作记录
  loadOperationRecords()
})

// 监听项目表单变化
watch(projectForm, () => {
  if (saveProjectInfoTimer.value) {
    clearTimeout(saveProjectInfoTimer.value)
  }
  saveProjectInfoTimer.value = setTimeout(() => {
    saveProjectInfo()
  }, 1000)
}, { deep: true })

// 切换到操作记录标签时刷新数据
watch(activeBottomTab, (tab) => {
  if (tab === 'operation') loadOperationRecords()
})
</script>

<template>
  <div class="editor-page">
    <!-- 顶部导航栏 -->
    <AppHeader @command="handleUserCommand">
      <template #actions>
        <el-tooltip content="AI 智能助手" placement="bottom" :show-after="300">
          <el-button
            :type="showConfigPanel ? 'primary' : 'default'"
            circle
            @click="switchGenConfig"
          >
            <el-icon><MagicStick /></el-icon>
          </el-button>
        </el-tooltip>
      </template>
      <template #dropdown-items>
        <!-- <el-dropdown-item divided command="settings" :icon="Setting">
          模板管理
        </el-dropdown-item> -->
      </template>
    </AppHeader>

    <!-- 编辑器主体 -->
    <div class="editor-container" :style="editorContainerStyle" :class="{
      'with-config-panel': showConfigPanel,
      'outline-collapsed': isOutlineCollapsed,
      'resizing': isResizingChat
    }">
      <!-- 章节导航 -->
      <DocumentOutline
        :chapters="chapters"
        :chapterStatus="chapterGenerationStatus"
        @chapter-click="handleChapterClick"
        @chapter-collapse="handleChapterCollapse"
        @outline-toggle="handleOutlineToggle"
      />

      <!-- 编辑区 -->
      <main class="editor-main">
        <div class="document-editor">
          <div class="document-header">
            <div class="document-header-content">
              <div
                class="document-title"
                contenteditable="true"
                @blur="updateDocumentTitle(($event.target as HTMLElement).textContent || '')"
                @keydown.enter.prevent="($event.target as HTMLElement).blur()"
              >
                {{ documentTitle }}
              </div>
              <!-- 项目信息摘要 -->
              <!-- <div v-if="projectSummary" class="project-summary">
                <el-tag size="small" type="info">{{ projectSummary }}</el-tag>
              </div> -->
              <div class="document-meta">
                <el-tag v-for="tag in activeDocTagLabels" :key="tag.name" :type="tag.type" size="small">{{ tag.name }}</el-tag>
                <el-popover
                  :visible="showDocTagPopover"
                  placement="bottom-start"
                  :width="320"
                  @update:visible="(val: boolean) => { if (!val) showDocTagPopover = false }"
                >
                  <template #reference>
                    <span v-if="activeDocTagLabels.length > 0" class="doc-tag-edit-btn" @click="openDocTagPopover">编辑</span>
                    <el-button v-else size="small" text class="doc-tag-add-btn" @click="openDocTagPopover">
                      <el-icon><Plus /></el-icon>
                      <span>添加标签</span>
                    </el-button>
                  </template>
                  <div class="doc-tag-popover">
                    <div class="doc-tag-group">
                      <div class="doc-tag-group-label">专业分类</div>
                      <div class="doc-tag-grid">
                        <el-tag
                          v-for="tag in cachedProfessionTags" :key="tag.id"
                          :type="editProfessionTagId === tag.id ? 'primary' : 'info'"
                          :effect="editProfessionTagId === tag.id ? 'dark' : 'plain'"
                          size="small" class="doc-tag-selectable"
                          @click="toggleEditTag(tag.id, 'profession')"
                        >{{ tag.name }}</el-tag>
                      </div>
                    </div>
                    <div class="doc-tag-group">
                      <div class="doc-tag-group-label">业态分类</div>
                      <div class="doc-tag-grid">
                        <el-tag
                          v-for="tag in cachedBusinessTypeTags" :key="tag.id"
                          :type="editBusinessTypeTagId === tag.id ? 'primary' : 'info'"
                          :effect="editBusinessTypeTagId === tag.id ? 'dark' : 'plain'"
                          size="small" class="doc-tag-selectable"
                          @click="toggleEditTag(tag.id, 'business_type')"
                        >{{ tag.name }}</el-tag>
                      </div>
                    </div>
                    <div class="doc-tag-popover-footer">
                      <el-button size="small" @click="showDocTagPopover = false">取消</el-button>
                      <el-button size="small" type="primary" @click="saveDocTags">保存</el-button>
                    </div>
                  </div>
                </el-popover>
              </div>
            </div>
            <div class="document-operations">
              <el-button
                size="small"
                type="default"
                :icon="Document"
                class="doc-op-btn doc-op-save"
                @click="saveDocument"
              >保存</el-button>
            </div>
          </div>

          <div class="editor-content">
            <section v-if="isServerDoc" class="chapter-section markdown-section">
              <MarkdownEditor
                v-model="currentBlockContent"
                :in-generating="inGenerating"
                :current-chapter="currentChapter"
                :show-citation="showCitation"
                @update:modelValue="handleMarkdownUpdate"
                @blur="handleMarkdownUpdate"
                @save="saveMarkdownContent"
              />
            </section>
          </div>

          <!-- 引用资料 & 操作记录 -->
          <div class="reference-materials-bottom">
            <div class="reference-header" @click="toggleReferenceMaterials">
              <h3 class="reference-title">
                <el-icon class="reference-icon" :class="{ 'expanded': isReferenceMaterialsExpanded }">
                  <ArrowRight />
                </el-icon>
                <span v-if="!isReferenceMaterialsExpanded" class="collapsed-title">
                  {{ activeBottomTab === 'reference' ? '引用资料' : '操作记录' }}
                </span>
                <div v-else class="bottom-tabs">
                  <span
                    class="bottom-tab"
                    :class="{ 'active': activeBottomTab === 'reference' }"
                    @click.stop="activeBottomTab = 'reference'"
                  >引用资料</span>
                  <span
                    class="bottom-tab"
                    :class="{ 'active': activeBottomTab === 'operation' }"
                    @click.stop="activeBottomTab = 'operation'"
                  >操作记录</span>
                </div>
              </h3>
              <el-icon class="toggle-icon" :class="{ 'expanded': isReferenceMaterialsExpanded }">
                <ArrowRight />
              </el-icon>
            </div>

            <el-collapse-transition>
              <div v-show="isReferenceMaterialsExpanded" class="reference-content-wrapper">
                <div class="reference-content">
                  <template v-if="activeBottomTab === 'reference'">
                    <div
                      v-if="!(currentChapter && currentChapter.docReference?.length)"
                      class="reference-empty"
                    >
                      <el-icon class="empty-icon"><Document /></el-icon>
                      <span class="empty-text">暂无引用资料</span>
                    </div>
                    <div
                      v-if="currentChapter && currentChapter.docReference && currentChapter.docReference.length"
                      class="reference-items"
                    >
                      <div
                        class="reference-item"
                        v-for="(refItem, index) in currentChapter.docReference"
                        :key="refItem.doc_name || index"
                      >
                        <div class="item-header">
                          <span class="item-title">{{ refItem.doc_name }}</span>
                          <span v-if="refItem.count" class="item-count">{{ refItem.count }} 处引用</span>
                        </div>
                      </div>
                    </div>
                  </template>

                  <template v-if="activeBottomTab === 'operation'">
                    <div v-if="operationRecords.length" style="text-align: right; margin-bottom: 4px;">
                      <el-button type="danger" link size="small" @click="handleClearRecords">清空记录</el-button>
                    </div>
                    <div v-if="!operationRecords.length" class="reference-empty">
                      <el-icon class="empty-icon"><Document /></el-icon>
                      <span class="empty-text">暂无操作记录</span>
                    </div>
                    <div class="opretaion-item" style="margin:10px 0" v-for="record in operationRecords" :key="record.id">
                      <div class="item-header">
                        <span class="item-title">{{ new Date(record.created_at || '').toLocaleString('zh-CN') }}</span>
                      </div>
                      <div class="item-description">
                        {{ ACTION_TYPE_LABELS[record.action_type] || record.action_type }}
                        <template v-if="record.chapter_name"> - {{ record.chapter_name }}</template>
                        <template v-if="record.action_detail"> - {{ record.action_detail }}</template>
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </el-collapse-transition>
          </div>
        </div>
      </main>
      <ChatAssistant
        v-model:visible="showConfigPanel"
        :width="chatAssistantWidth"
        @resize="handleChatResize"
        @resize-start="isResizingChat = true"
        @resize-end="isResizingChat = false"
        :current-chapter="currentChapter"
        :current-chapter-id="currentChapterId"
        :document-title="documentTitle"
        :project-id="currentDocumentId"
        :project-info="projectForm"
        @content-streaming="handleContentStreaming"
        @content-generated="handleContentGenerated"
        @generation-stopped="recordOperation('generation_stopped', currentChapter?.title, '用户中途停止了AI生成')"
        @update:enable-citation="(val: boolean) => showCitation = val"
      />
    </div>
  </div>
</template>

<style scoped>
.editor-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
}


/* 编辑器布局 - 无左侧文档列表 */
.editor-container {
  display: grid;
  grid-template-columns: 280px 1fr;
  height: calc(100vh - 56px);
  background: var(--gray-100);
  transition: grid-template-columns 0.3s ease;
}

.editor-container.resizing {
  transition: none;
  user-select: none;
}

.editor-container.with-config-panel {
  grid-template-columns: 280px 1fr var(--chat-width, 380px);
}

.editor-container.outline-collapsed {
  grid-template-columns: 48px 1fr;
}

.editor-container.outline-collapsed.with-config-panel {
  grid-template-columns: 48px 1fr var(--chat-width, 380px);
}

/* 文档编辑器 */
.document-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.document-header {
  flex-shrink: 0;
  padding: 16px;
  padding-left: 24px;
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
  border-bottom: 1px solid #e4e7ed;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.document-header-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.document-title {
  font-size: 24px;
  font-weight: 700;
  cursor: text;
  color: #1f2937;
  line-height: 1.3;
  transition: all 0.2s ease;
  border-radius: 6px;
  padding: 4px 8px;
  margin: -4px -8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.document-title:hover {
  background: #f1f5f9;
  padding: 4px 8px;
}

.document-title:focus {
  outline: 2px solid #3b82f6;
  background: white;
  padding: 4px 8px;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.project-summary {
  margin: 0;
  padding: 0;
  flex-shrink: 0;
}

.project-summary .el-tag {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border-radius: 6px;
  font-weight: 500;
  padding: 6px 12px;
  border: 1px solid #0ea5e9;
  color: #0369a1;
  font-size: 12px;
}

.document-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  flex-shrink: 0;

  .el-tag {
    border-radius: 6px;
    font-weight: 500;
    padding: 4px 12px;
    transition: all 0.2s ease;
    white-space: nowrap;

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
  }
}

.doc-tag-edit-btn {
  font-size: 12px;
  color: var(--el-color-primary);
  cursor: pointer;
  line-height: 24px;
  &:hover {
    text-decoration: underline;
  }
}

.doc-tag-add-btn {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 2px 8px;
  height: auto;
  .el-icon {
    font-size: 12px;
    margin-right: 2px;
  }
  &:hover {
    color: var(--el-color-primary);
  }
}

.doc-tag-popover {
  .doc-tag-group {
    margin-bottom: 12px;
    &:last-child { margin-bottom: 0; }
  }
  .doc-tag-group-label {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    margin-bottom: 6px;
    font-weight: 500;
  }
  .doc-tag-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .doc-tag-selectable {
    cursor: pointer;
    user-select: none;
    transition: all 0.15s ease;
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
  }
  .doc-tag-popover-footer {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--el-border-color-lighter);
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}

.document-operations {
  display: flex;
  flex-shrink: 0;

  .el-button {
    transition: all 0.2s ease;
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
  }
  .doc-op-btn {
    border-radius: 999px;
    font-weight: 600;
    padding: 6px 12px;
  }
  .doc-op-exit {
    background: #f8fafc;
    border-color: #e5e7eb;
    color: #64748b;
  }
  .doc-op-exit:hover {
    background: #eef2f7;
    color: #374151;
  }
}

/* 编辑器主区域 */
.editor-main {
  background: white;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.editor-content {
  flex: 1;
  overflow: hidden;
  padding: 0;
  width: 100%;
  background: #ffffff;
  display: flex;
  flex-direction: column;
}

.chapter-section {
  margin-bottom: 48px;
  padding: 24px;
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
}

.markdown-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  border-radius: 0;
  overflow: hidden;
  margin: 0;
  padding: 0;
  border: none;
}

.markdown-section :deep(.markdown-editor) {
  flex: 1;
  height: 100%;
  min-height: 0;
  border: none;
  border-radius: 0;
  box-shadow: none;
}

/* 引用资料底部区域 */
.reference-materials-bottom {
  position: sticky;
  bottom: 0;
  background: white;
  border-top: 2px solid var(--gray-200);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
  margin-top: 6px;
}

.reference-materials-bottom .reference-header {
  cursor: pointer;
  padding: 8px 24px;
  background: var(--gray-50);
  border-bottom: 1px solid var(--gray-200);
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.3s ease;
}

.reference-materials-bottom .reference-header:hover {
  background: var(--gray-100);
}

.reference-materials-bottom .reference-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--gray-800);
  display: flex;
  align-items: center;
  gap: 8px;
}

.bottom-tabs {
  display: flex;
  gap: 4px;
}

.bottom-tab {
  font-size: 14px;
  font-weight: 500;
  color: var(--gray-500);
  cursor: pointer;
  padding: 2px 10px;
  border-radius: 4px;
  transition: color 0.2s, background 0.2s;
}

.bottom-tab:hover {
  color: var(--primary-color);
  background: var(--primary-light, rgba(64, 158, 255, 0.08));
}

.bottom-tab.active {
  color: var(--primary-color);
  font-weight: 600;
  background: var(--primary-light, rgba(64, 158, 255, 0.1));
}

.reference-materials-bottom .reference-icon {
  transition: transform 0.3s ease;
  color: var(--primary-color);
}

.reference-materials-bottom .reference-icon.expanded {
  transform: rotate(90deg);
}

.reference-materials-bottom .collapsed-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--gray-600);
}

.reference-materials-bottom .toggle-icon {
  font-size: 16px;
  color: var(--gray-400);
  transition: transform 0.3s ease, color 0.2s;
  transform: rotate(90deg);
  cursor: pointer;
}

.reference-materials-bottom .toggle-icon.expanded {
  transform: rotate(-90deg);
  color: var(--primary-color);
}

.reference-materials-bottom .reference-header:hover .toggle-icon {
  color: var(--primary-color);
}

.reference-materials-bottom .reference-content-wrapper {
  background: white;
}

.reference-materials-bottom .reference-content {
  max-height: 35vh;
  overflow-y: auto;
  padding: 20px 24px;
  scrollbar-width: thin;
  scrollbar-color: var(--gray-300) transparent;
}

.reference-materials-bottom .reference-content::-webkit-scrollbar {
  width: 6px;
}

.reference-materials-bottom .reference-content::-webkit-scrollbar-track {
  background: transparent;
}

.reference-materials-bottom .reference-content::-webkit-scrollbar-thumb {
  background-color: var(--gray-300);
  border-radius: 3px;
}

.reference-materials-bottom .reference-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  border: 1px dashed var(--gray-300);
  border-radius: 8px;
  background: var(--gray-50);
  color: var(--gray-600);
}

.reference-materials-bottom .reference-empty .empty-icon {
  color: var(--gray-400);
  font-size: 18px;
  margin-right: 8px;
}

.reference-materials-bottom .reference-empty .empty-text {
  font-size: 13px;
}

.reference-materials-bottom .reference-items {
  display: grid;
  gap: 10px;
}

.reference-materials-bottom .reference-item {
  padding: 14px;
  background: var(--gray-50);
  border-radius: 8px;
  border-left: 4px solid var(--primary-color);
  transition: all 0.2s ease;
}

.reference-materials-bottom .reference-item:hover {
  background: var(--gray-100);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.reference-materials-bottom .item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.reference-materials-bottom .item-title {
  font-weight: 600;
  color: var(--gray-800);
  font-size: 14px;
}

.reference-materials-bottom .item-count {
  font-size: 12px;
  color: var(--gray-500);
  white-space: nowrap;
}

.reference-materials-bottom .item-description {
  color: var(--gray-600);
  font-size: 13px;
  line-height: 1.5;
}

.opretaion-item {
  padding: 14px;
  background: var(--gray-50);
  border-radius: 8px;
  margin: 10px 0px;
  border-left: 4px solid var(--primary-color);
  transition: all 0.2s ease;
}

/* 响应式 */
@media (max-width: 1200px) {
  .editor-container {
    grid-template-columns: 200px 1fr;
  }
}

@media (max-width: 768px) {
  .editor-container {
    grid-template-columns: 1fr;
  }
}
</style>
