<template>
  <div class="review-page">
    <!-- 顶部导航栏 -->
    <header class="review-header">
      <el-button :icon="ArrowLeft" @click="goHome">返回主页</el-button>
    </header>
    <!-- 双栏布局 -->
    <div class="review-create">
      <!-- 左栏：输入配置 -->
      <div class="review-create-left">
        <div class="review-create-card">
          <div class="review-create-header">
            <span class="review-step-badge">①</span>
            <div>
              <h2>规范审查</h2>
              <p class="review-create-desc">上传施工图设计说明文件后，直接创建审查任务</p>
            </div>
          </div>

          <!-- 文件上传 -->
          <div class="review-input-content">
            <el-upload
              ref="fileUploadRef"
              drag
              accept=".md,.txt"
              :auto-upload="false"
              :show-file-list="false"
              :limit="1"
              :on-change="handleFileChange"
              :on-exceed="handleFileExceed"
              class="review-file-upload"
            >
              <div class="upload-drop-zone">
                <div class="upload-drop-icon">
                  <el-icon :size="36"><UploadFilled /></el-icon>
                </div>
                <div class="upload-drop-text">
                  拖拽文件到此处，或 <span class="upload-drop-link">点击选择文件</span>
                </div>
                <div class="upload-drop-formats">
                  <span class="upload-format-badge">.md</span>
                  <span class="upload-format-badge">.txt</span>
                </div>
              </div>
            </el-upload>
            <!-- <p class="review-upload-tip">文件大小不超过 1MB，选择后立即上传到 OSS</p> -->
            <div v-if="uploadedFileName" class="review-uploaded-file" :class="`upload-${uploadStatus}`">
              <el-icon :size="16"><DocumentIcon /></el-icon>
              <span class="review-uploaded-name">{{ uploadedFileName }}</span>
              <span v-if="uploadStatus === 'uploading'" class="review-upload-status">上传中...</span>
              <span v-else-if="uploadStatus === 'uploaded'" class="review-upload-status">&#10003;</span>
              <span v-else-if="uploadStatus === 'failed'" class="review-upload-status">上传失败</span>
              <el-button link type="danger" size="small" @click="removeUploadedFile">移除</el-button>
            </div>
          </div>

          <!-- 审查维度 -->
          <div class="review-dimensions-card">
            <h4 class="review-dimensions-title">审查维度</h4>
            <el-checkbox-group v-model="selectedDimensions" class="review-dimensions-group">
              <el-checkbox value="compliance">规范符合性</el-checkbox>
              <el-checkbox value="completeness">完整性检查</el-checkbox>
              <el-checkbox value="terminology">术语规范性</el-checkbox>
            </el-checkbox-group>
          </div>
        </div>
      </div>

      <!-- 右栏：范围确认 / 审查进度 ② -->
      <div class="review-create-right">
        <div class="review-scope-panel">
          <div class="review-scope-panel-header">
            <div class="review-scope-panel-title-row">
              <span class="review-step-badge">②</span>
              <h3>审查范围</h3>
            </div>
          </div>

          <div v-if="selectedStandardIds.length > 0" class="review-scope-list">
            <div class="review-scope-section-label">已选择</div>
            <div
              v-for="item in selectedScopeStandards"
              :key="item.standardId"
              class="review-scope-item"
            >
              <div class="review-scope-item-info">
                <div class="review-scope-item-top">
                  <span class="review-scope-item-number">{{ item.number }}</span>
                  <el-tag v-if="item.status === 'superseded'" size="small" type="info">废止</el-tag>
                </div>
                <div class="review-scope-item-name">{{ item.name }}</div>
                <div class="review-scope-item-meta">
                  {{ item.clauseCount }} 条条文 · {{ item.checkpointCount }} 个检查点
                </div>
              </div>
              <el-button
                link
                type="danger"
                size="small"
                class="review-scope-item-remove"
                @click.stop="removeManualStandard(item.standardId)"
              >
                <el-icon :size="14"><Close /></el-icon>
              </el-button>
            </div>
            <div class="review-scope-manual">
              <el-button size="small" @click="manualAddDialogVisible = true">
                + 手动添加标准
              </el-button>
            </div>
          </div>

          <div v-else class="review-scope-no-result">
            <p class="review-scope-no-text">尚未选择规范标准</p>
            <p class="review-scope-no-hint">可通过下方按钮添加标准</p>
            <div class="review-scope-manual">
              <el-button size="small" @click="manualAddDialogVisible = true">
                + 手动添加标准
              </el-button>
            </div>
          </div>

          <div class="review-scope-action">
            <el-button
              type="primary"
              size="large"
              :icon="Search"
              :loading="isCreating"
              :disabled="!canCreate"
              @click="startReview"
              class="review-scope-start-btn"
            >
              创建审查
            </el-button>
            <p v-if="!canCreate && !isCreating" class="review-scope-action-hint">
              <template v-if="uploadStatus === 'uploading'">文件正在上传至 OSS，请稍候...</template>
              <template v-else-if="uploadStatus === 'failed'">文件上传失败，请移除后重新上传</template>
              <template v-else-if="!uploadedFileName">请上传待审查的施工图设计说明文件</template>
              <template v-else>文件上传未完成，请稍候...</template>
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 手动添加弹窗 -->
    <el-dialog v-model="manualAddDialogVisible" title="添加规范标准" width="480px">
      <el-input
        v-model="manualAddSearch"
        placeholder="搜索标准编号或名称..."
        :prefix-icon="Search"
        clearable
      />
      <div class="manual-add-list">
        <div
          v-for="std in filteredManualStandards"
          :key="std.id"
          class="manual-add-item"
          :class="{ added: selectedStandardIds.includes(std.id) }"
          @click="addManualStandard(std.id)"
        >
          <div class="manual-add-left">
            <span class="manual-add-number">{{ std.number }}</span>
            <span class="manual-add-name">{{ std.name }}</span>
          </div>
          <el-tag v-if="selectedStandardIds.includes(std.id)" size="small" type="success">已添加</el-tag>
          <el-icon v-else :size="16"><Plus /></el-icon>
        </div>
      </div>
      <template #footer>
        <el-button @click="manualAddDialogVisible = false">完成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Search,
  UploadFilled,
  Document as DocumentIcon,
  Plus,
  ArrowLeft,
  Close,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { UploadInstance, UploadRawFile } from 'element-plus'
import {
  fetchAllStandards,
  fetchStandardScope,
  createReviewApi,
  getOssUploadSignature,
  uploadFileToOss,
  type StandardScope,
  type ReviewDimension,
} from '../service/reviewService'
import { loginToClawith, createClawithSession } from '../service/clawithService'

// ===== 状态 =====
const router = useRouter()

function goHome() {
  router.push('/home')
}

const selectedDimensions = ref<ReviewDimension[]>(['compliance'])
const uploadedFileName = ref('')
const isCreating = ref(false)
const fileUploadRef = ref<UploadInstance | null>(null)
const selectedStandardIds = ref<string[]>([])

// OSS 上传状态
const ossFileKey = ref('')
const uploadStatus = ref<'idle' | 'uploading' | 'uploaded' | 'failed'>('idle')
const uploadRequestSeq = ref(0)

// ===== 审查范围 =====
const manualAddDialogVisible = ref(false)
const manualAddSearch = ref('')
const allStandardsList = ref<{ id: string; number: string; name: string; profession: string }[]>([])
const selectedScopeStandards = ref<StandardScope[]>([])

const filteredManualStandards = computed(() => {
  if (!manualAddSearch.value) return allStandardsList.value
  const kw = manualAddSearch.value.toLowerCase()
  return allStandardsList.value.filter(s =>
    s.number.toLowerCase().includes(kw) || s.name.toLowerCase().includes(kw)
  )
})

// 页面加载时从后端获取标准列表
async function loadStandards() {
  try {
    allStandardsList.value = await fetchAllStandards()
  } catch (err) {
    console.error('加载标准列表失败:', err)
    ElMessage.warning('加载标准列表失败')
  }
}

// 选中标准变化时更新范围统计
async function loadSelectedScope() {
  if (selectedStandardIds.value.length === 0) {
    selectedScopeStandards.value = []
    return
  }
  try {
    selectedScopeStandards.value = await fetchStandardScope(selectedStandardIds.value)
  } catch (err) {
    console.error('加载审查范围失败:', err)
  }
}

onMounted(() => { void loadStandards() })
watch(selectedStandardIds, () => { void loadSelectedScope() }, { deep: true })

const canCreate = computed(() => {
  if (selectedDimensions.value.length === 0) return false
  if (uploadStatus.value !== 'uploaded') return false
  if (!ossFileKey.value) return false
  if (!uploadedFileName.value) return false
  if (isCreating.value) return false
  return true
})

// ===== 方法 =====

function resetUploadState() {
  uploadedFileName.value = ''
  ossFileKey.value = ''
  uploadStatus.value = 'idle'
  uploadRequestSeq.value += 1
}

function handleFileChange(uploadFile: { raw?: UploadRawFile; name: string }) {
  const file = uploadFile.raw
  if (!file) return
  if (!/\.(md|txt)$/i.test(file.name)) {
    ElMessage.warning('仅支持 .txt、.md 文件')
    resetUploadState()
    fileUploadRef.value?.clearFiles()
    return
  }
  if (file.size > 1024 * 1024) {
    ElMessage.warning('文件大小不能超过 1MB')
    resetUploadState()
    fileUploadRef.value?.clearFiles()
    return
  }
  uploadedFileName.value = uploadFile.name

  // 立即上传到 OSS
  uploadStatus.value = 'uploading'
  ossFileKey.value = ''
  const seq = ++uploadRequestSeq.value
  getOssUploadSignature()
    .then(sig => uploadFileToOss(file, sig))
    .then(key => {
      if (seq !== uploadRequestSeq.value) return
      ossFileKey.value = key
      uploadStatus.value = 'uploaded'
    })
    .catch(err => {
      if (seq !== uploadRequestSeq.value) return
      console.error('OSS 上传失败:', err)
      uploadStatus.value = 'failed'
      ElMessage.error('文件上传失败，请重试')
    })
}

function handleFileExceed() {
  ElMessage.warning('只能上传一个文件')
  resetUploadState()
  fileUploadRef.value?.clearFiles()
}

function removeUploadedFile() {
  resetUploadState()
  if (fileUploadRef.value) {
    fileUploadRef.value.clearFiles()
  }
}

function addManualStandard(standardId: string) {
  const idx = selectedStandardIds.value.indexOf(standardId)
  if (idx === -1) {
    selectedStandardIds.value.push(standardId)
  } else {
    selectedStandardIds.value.splice(idx, 1)
  }
}

function removeManualStandard(standardId: string) {
  const idx = selectedStandardIds.value.indexOf(standardId)
  if (idx !== -1) selectedStandardIds.value.splice(idx, 1)
}

async function startReview() {
  if (!canCreate.value) {
    ElMessage.warning('请先完成文件上传并至少选择一个审查维度')
    return
  }

  isCreating.value = true
  try {
    // 1. 登录 Clawith，创建独立 session
    const clawithJWT = await loginToClawith()
    const sessionId = await createClawithSession(clawithJWT, `审查: ${uploadedFileName.value}`)

    // 2. 创建审查记录（携带 clawithSessionId）
    const result = await createReviewApi({
      documentName: uploadedFileName.value,
      dimensions: selectedDimensions.value,
      standardIds: selectedStandardIds.value,
      ossFileKey: ossFileKey.value,
      clawithSessionId: sessionId,
    })

    // 3. 跳转到结果页，传递参数
    router.push({
      path: `/review/${result.id}`,
      query: {
        manifestUrl: result.manifestUrl || '',
        clawithSessionId: sessionId,
      },
    })
  } catch (error) {
    console.error('创建审查失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '创建审查失败，请重试')
  } finally {
    isCreating.value = false
  }
}
</script>

<style scoped>
/* ===== 整体布局 ===== */
.review-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--gray-50);
}

/* ===== 顶部导航栏 ===== */
.review-header {
  display: flex;
  align-items: center;
  padding: 0 20px;
  height: 56px;
  background: linear-gradient(135deg, #ffffff 0%, #fafbfc 100%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  flex-shrink: 0;
}

.review-create {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ===== 左栏 ===== */
.review-create-left {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.review-create-card {
  max-width: 680px;
  margin: 0 auto;
}

.review-create-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 24px;
}

.review-create-header h2 {
  font-size: 22px;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0 0 4px;
}

.review-create-desc {
  font-size: 14px;
  color: var(--gray-500);
  margin: 0;
  line-height: 1.5;
}

/* 步骤编号徽章 */
.review-step-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
  background: var(--primary-color);
  color: #fff;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.review-input-content {
  margin-bottom: 8px;
}

/* 上传拖拽区 */
.upload-drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  border: 2px dashed #d1d5db;
  border-radius: 12px;
  background: #f9fafb;
  cursor: pointer;
  transition: all 0.25s ease;
}

.upload-drop-zone:hover {
  border-color: #93c5fd;
  background: #f0f7ff;
}

.review-file-upload :deep(.is-dragover) .upload-drop-zone {
  border-color: var(--primary-color);
  background: #eff6ff;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
  transform: scale(1.01);
}

.upload-drop-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: #eff6ff;
  color: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
  transition: all 0.25s ease;
}

.review-file-upload :deep(.is-dragover) .upload-drop-icon {
  background: var(--primary-color);
  color: #fff;
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.35);
}

.upload-drop-text {
  font-size: 14px;
  color: var(--gray-600);
  margin-bottom: 14px;
}

.upload-drop-link {
  color: var(--primary-color);
  font-weight: 600;
}

.upload-drop-formats {
  display: flex;
  gap: 8px;
}

.upload-format-badge {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  background: #e5e7eb;
  color: #6b7280;
  letter-spacing: 0.3px;
}

.review-file-upload :deep(.el-upload) {
  width: 100%;
}

.review-file-upload :deep(.el-upload-dragger) {
  width: 100%;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
}

.review-upload-tip {
  margin-top: 10px;
  font-size: 12px;
  color: var(--gray-400);
  text-align: center;
  margin-bottom: 0;
}

.review-uploaded-file {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 10px 14px;
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  font-size: 13px;
  transition: all 0.2s ease;
}

.review-uploaded-file.upload-uploaded {
  background: #f0fdf4;
  border-color: #bbf7d0;
}

.review-uploaded-file.upload-failed {
  background: #fef2f2;
  border-color: #fecaca;
}

.review-uploaded-file.upload-uploading {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.review-uploaded-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--gray-700);
}

.review-upload-status {
  font-size: 12px;
  margin-right: 8px;
  flex-shrink: 0;
}

.upload-uploaded .review-upload-status { color: #16a34a; }
.upload-failed .review-upload-status { color: #dc2626; }
.upload-uploading .review-upload-status { color: #2563eb; }

/* 审查维度 */
.review-dimensions-card {
  margin-top: 8px;
  padding: 16px 18px;
  background: #f8fafc;
  border: 1px solid var(--gray-100);
  border-radius: 10px;
}

.review-dimensions-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--gray-500);
  margin: 0 0 10px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.review-dimensions-group {
  display: flex;
  gap: 16px;
}

/* ===== 右栏分隔线 ===== */
.review-create-right {
  width: 380px;
  flex-shrink: 0;
  border-left: 1px solid var(--gray-200);
  background: white;
  overflow-y: auto;
}

/* ===== 右栏：范围确认 ===== */
.review-scope-panel {
  padding: 24px 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.review-scope-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.review-scope-panel-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.review-scope-panel-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0;
}

/* 标准列表 */
.review-scope-list {
  flex: 1;
  overflow-y: auto;
}

.review-scope-section-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--gray-400);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}

.review-scope-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  margin-bottom: 8px;
  transition: background 0.12s;
}

.review-scope-item:hover {
  background: var(--gray-50);
}

.review-scope-item-remove {
  flex-shrink: 0;
  margin-left: 8px;
  opacity: 0;
  transition: opacity 0.15s;
}

.review-scope-item:hover .review-scope-item-remove {
  opacity: 1;
}

.review-scope-item-info {
  flex: 1;
}

.review-scope-item-top {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}

.review-scope-item-number {
  font-size: 13px;
  font-weight: 600;
  color: var(--primary-color);
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
}

.review-scope-item-name {
  font-size: 13px;
  color: var(--gray-700);
}

.review-scope-item-meta {
  font-size: 11px;
  color: var(--gray-400);
  margin-top: 2px;
}

/* 未检测到 */
.review-scope-no-result {
  text-align: center;
  padding: 24px 16px;
  background: var(--gray-50);
  border-radius: 8px;
}

.review-scope-no-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--gray-600);
  margin: 0 0 4px;
}

.review-scope-no-hint {
  font-size: 12px;
  color: var(--gray-400);
  margin: 0;
}

/* 手动添加 */
.review-scope-manual {
  margin-top: 4px;
}

.review-scope-no-result .review-scope-manual {
  margin-top: 12px;
}

/* 开始审查 */
.review-scope-action {
  margin-top: auto;
  padding: 16px;
  background: #f8fafc;
  border: 1px solid var(--gray-100);
  border-radius: 10px;
}

.review-scope-start-btn {
  width: 100%;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25);
}

.review-scope-action-hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--gray-400);
  text-align: center;
}

/* ===== 手动添加弹窗 ===== */
.manual-add-list {
  margin-top: 12px;
  max-height: 320px;
  overflow-y: auto;
}

.manual-add-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s;
}

.manual-add-item:hover {
  background: var(--gray-50);
}

.manual-add-item.added {
  opacity: 0.6;
}

.manual-add-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.manual-add-number {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary-color);
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
}

.manual-add-name {
  font-size: 13px;
  color: var(--gray-700);
}

/* ===== 响应式 ===== */
@media (max-width: 860px) {
  .review-create {
    flex-direction: column;
  }

  .review-create-left {
    flex: none;
    overflow-y: visible;
    padding: 20px 16px;
  }

  .review-create-card {
    max-width: 100%;
  }

  .review-create-right {
    width: 100%;
    flex-shrink: 1;
    border-left: none;
    border-top: 1px solid var(--gray-200);
    overflow-y: visible;
  }

  .review-scope-panel {
    height: auto;
    padding: 20px 16px;
    min-height: 0;
  }

  .review-scope-action {
    margin-top: 20px;
  }
}

@media (max-width: 480px) {
  .review-header {
    padding: 0 12px;
  }

  .review-create-left {
    padding: 16px 12px;
  }

  .upload-drop-zone {
    padding: 28px 16px;
  }

  .upload-drop-icon {
    width: 44px;
    height: 44px;
    margin-bottom: 10px;
  }

  .upload-drop-text {
    font-size: 13px;
  }

  .review-dimensions {
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>
