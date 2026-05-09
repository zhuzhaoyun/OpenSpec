<template>
  <div class="review-result-page">
    <div v-if="loading" class="review-loading-state">
      <el-icon :size="40" class="is-loading"><Loading /></el-icon>
      <p>加载审查结果...</p>
    </div>

    <div v-else-if="notFound" class="review-not-found">
      <h2>审查记录未找到</h2>
      <p>该审查记录可能已被删除</p>
      <el-button @click="goToList">返回审查列表</el-button>
    </div>

    <div v-else-if="recordLoadError" class="review-not-found review-load-error">
      <h2>审查结果加载失败</h2>
      <p>{{ recordLoadError }}</p>
      <div class="review-load-error-actions">
        <el-button type="primary" @click="retryLoadRecord">重试</el-button>
        <el-button @click="goToList">返回审查列表</el-button>
      </div>
    </div>

    <template v-else>
      <header class="review-toolbar">
        <div class="review-toolbar-left">
          <el-button size="small" @click="goToList">
            <el-icon><ArrowLeft /></el-icon> 返回列表
          </el-button>
          <span class="review-toolbar-divider" />
          <h3 class="review-toolbar-title">规范审查</h3>
          <span class="review-toolbar-divider" />
          <span class="review-toolbar-docname">{{ record.documentName }}</span>
        </div>
        <div class="review-toolbar-actions">
          <el-button size="small" :icon="Download" :disabled="!isReviewCompleted" @click="exportReport">导出报告</el-button>
        </div>
      </header>

      <div class="review-summary" :class="summaryStateClass">
        <div class="review-summary-header">
          <el-icon :size="18" :color="summaryIconColor">
            <CircleCheckFilled v-if="isReviewCompleted" />
            <WarningFilled v-else />
          </el-icon>
          <span>{{ summaryStatusText }}</span>
        </div>
        <div class="review-summary-dims">
          审查维度：{{ dimLabels || '未设置' }}
        </div>
        <div v-if="missingSource" class="review-summary-note">
          缺少可回显源文件
        </div>
        <div v-else-if="sourceLoadError" class="review-summary-note review-summary-note-error">
          {{ sourceLoadError }}
        </div>
        <div v-if="hasIssues" class="review-summary-stats">
          <div v-for="s in severityStats" :key="s.key" class="rs-item" :class="`rs-${s.key}`">
            <span class="rs-dot" />
            <span class="rs-count">{{ s.count }}</span>
            <span class="rs-label">{{ s.label }}</span>
          </div>
          <span class="rs-divider" />
          <span class="rs-item rs-pending">
            <span class="rs-count">{{ pendingIssuesCount }}</span>
            <span class="rs-label">待处理</span>
          </span>
          <span v-if="resolvedIssuesCount > 0" class="rs-item rs-resolved">
            <span class="rs-count">{{ resolvedIssuesCount }}</span>
            <span class="rs-label">已处理</span>
          </span>
          <span v-if="ignoredIssuesCount > 0" class="rs-item rs-ignored">
            <span class="rs-count">{{ ignoredIssuesCount }}</span>
            <span class="rs-label">已忽略</span>
          </span>
        </div>
        <div v-else class="review-summary-empty" :class="summaryEmptyStateClass">
          <el-icon :size="16" :color="summaryIconColor">
            <CircleCheckFilled v-if="isReviewCompleted" />
            <WarningFilled v-else />
          </el-icon>
          {{ summaryEmptyText }}
        </div>
      </div>

      <div v-if="localResultSaveFailed" class="review-save-failed-bar">
        <el-icon :size="16"><WarningFilled /></el-icon>
        <span>审查结果已接收但保存失败</span>
        <el-button size="small" type="primary" @click="retrySaveResults">重试保存</el-button>
      </div>

      <div class="review-body">
        <div class="review-annotation-area" ref="annotationAreaRef">
          <div class="review-annotation-header">
            原文内容
            <span class="review-hint">· {{ sourcePanelHint }}</span>
          </div>

          <div v-if="missingSource" class="review-source-state review-source-state-missing">
            <el-icon :size="40"><WarningFilled /></el-icon>
            <h3 class="review-source-title">缺少可回显源文件</h3>
            <p class="review-source-desc">该审查记录未绑定可读取的源文件，当前阶段不再回退使用数据库内容。</p>
          </div>
          <div v-else-if="sourceLoadError" class="review-source-state review-source-state-error">
            <el-icon :size="40"><WarningFilled /></el-icon>
            <h3 class="review-source-title">源文件加载失败</h3>
            <p class="review-source-desc">{{ sourceLoadError }}</p>
          </div>
          <template v-else>
            <div v-if="annotationNotice" class="review-inline-empty" :class="annotationNoticeClass">
              <el-icon :size="16" :color="summaryIconColor">
                <CircleCheckFilled v-if="isReviewCompleted" />
                <WarningFilled v-else />
              </el-icon>
              <span>{{ annotationNotice }}</span>
            </div>

            <!-- 非终态：Markdown 渲染 -->
            <div v-if="isReviewPending" class="review-annotation-md">
              <MarkdownRenderer :content="sourceContent" />
            </div>

            <!-- 终态：Markdown 渲染 + 高亮 -->
            <div v-else-if="isReviewCompleted">
              <div v-if="sourceContent" ref="sourceContainerRef" class="review-annotation-md">
                <MarkdownRenderer :content="sourceContent" />
              </div>
              <div v-else class="review-source-state review-source-state-empty">
                <h3 class="review-source-title">源文件内容为空</h3>
                <p class="review-source-desc">当前记录关联的源文件没有可显示的文本内容。</p>
              </div>
            </div>

            <!-- 失败等其他状态：纯文本回显 -->
            <div v-else-if="sourceContent" class="review-annotation-text">
              <span>{{ sourceContent }}</span>
            </div>
            <div v-else class="review-source-state review-source-state-empty">
              <h3 class="review-source-title">源文件内容为空</h3>
              <p class="review-source-desc">当前记录关联的源文件没有可显示的文本内容。</p>
            </div>
          </template>

          <div v-if="hasRenderableSource && hasIssues" class="review-stats-float">
            <div v-for="s in severityStats" :key="s.key" class="stats-float-item" :class="`stats-${s.key}`">
              <span class="stats-dot" />
              <span class="stats-count">{{ s.count }}</span>
              <span class="stats-label">{{ s.label }}</span>
            </div>
          </div>
        </div>

        <div class="review-issue-panel">
          <div class="issue-panel-header">
            <span class="issue-panel-title">问题清单</span>
            <span v-if="totalIssuesCount > 0" class="issue-panel-badge">{{ totalIssuesCount }}</span>
          </div>

          <div class="issue-panel-summary">
            <div v-for="s in severityStats" :key="s.key" class="ips-item" :class="`ips-${s.key}`">
              <span class="ips-count">{{ s.count }}</span>
              <span class="ips-label">{{ s.label }}</span>
            </div>
          </div>

          <div class="issue-panel-list">
            <div v-if="sortedIssues.length === 0" class="issue-panel-empty" :class="issuePanelEmptyClass">
              {{ issuePanelEmptyText }}
            </div>
            <template v-else>
              <div
                v-for="issue in sortedIssues"
                :key="issue.id"
                class="issue-item"
                :class="[`sev-${issue.severity}`, { 'is-active': activeIssueId === issue.id, 'is-done': issue.status !== 'pending' }]"
              >
                <div class="issue-item-main" @click="focusIssue(issue.id)">
                  <div class="issue-item-top">
                    <span class="issue-item-sev">{{ severityLabel(issue.severity) }}</span>
                    <span class="issue-item-title">{{ issue.title }}</span>
                    <span class="issue-item-spacer" />
                    <span
                      v-if="issue.clauseId"
                      class="issue-item-count"
                      :class="{ 'has-multi': getMatchCount(issue.clauseId) > 1 }"
                      @click.stop="navigateMatch(issue)"
                    >{{ getMatchNavLabel(issue) }}</span>
                    <el-tag
                      size="small"
                      effect="plain"
                      :type="issue.status === 'resolved' ? 'success' : issue.status === 'ignored' ? 'info' : 'warning'"
                    >
                      {{ issueStatusLabel(issue.status) }}
                    </el-tag>
                  </div>
                  <div class="issue-item-desc">{{ issue.description }}</div>
                  <div v-if="issue.standardRef" class="issue-item-ref">{{ issue.standardRef }}<span v-if="issue.standardClause"> · 第{{ issue.standardClause }}条</span></div>
                </div>
              </div>
            </template>
          </div>

          <div class="issue-panel-detail">
            <div class="ipd-toggle" @click="detailExpanded = !detailExpanded">
              <span class="ipd-toggle-arrow">{{ detailExpanded ? '▼' : '▶' }}</span>
              <span class="ipd-toggle-text">{{ detailExpanded ? '收起详情' : '问题详情' }}</span>
              <span v-if="activeIssue && !detailExpanded" class="ipd-toggle-preview">
                {{ activeIssue.title }}
              </span>
            </div>
            <div
              v-if="detailExpanded"
              class="ipd-drag-handle"
              @mousedown.prevent="startDrag"
            >
              <span class="ipd-drag-dot" />
              <span class="ipd-drag-dot" />
              <span class="ipd-drag-dot" />
            </div>
            <div v-if="detailExpanded && activeIssue" class="ipd-body" :style="{ maxHeight: detailHeight + 'px' }">
              <div class="ipd-block" v-if="activeIssue.standardRef || activeIssue.standardClause">
                <span class="ipd-label">规范依据</span>
                <div class="ipd-value">
                  {{ activeIssue.standardRef }}<span v-if="activeIssue.standardClause"> · 第{{ activeIssue.standardClause }}条</span>
                </div>
              </div>
              <div class="ipd-block" v-if="activeIssue.originalSnippet">
                <span class="ipd-label">原文片段</span>
                <div class="ipd-value ipd-quote">"{{ activeIssue.originalSnippet }}"</div>
              </div>
              <div class="ipd-block" v-if="activeIssue.standardText">
                <span class="ipd-label">规范原文</span>
                <div class="ipd-value ipd-quote">"{{ activeIssue.standardText }}"</div>
              </div>
              <div class="ipd-block ipd-block-suggestion" v-if="activeIssue.suggestionText">
                <span class="ipd-label">修改建议</span>
                <div class="ipd-value ipd-suggestion">{{ activeIssue.suggestionText }}</div>
              </div>
              <div class="ipd-actions">
                <el-tag :type="activeIssue.status === 'resolved' ? 'success' : activeIssue.status === 'ignored' ? 'info' : 'warning'" size="small" effect="plain">
                  {{ issueStatusLabel(activeIssue.status) }}
                </el-tag>
                <el-button v-if="activeIssue.clauseId" link size="small" type="primary" @click.stop="navigateToClause(activeIssue)">查看条文 →</el-button>
              </div>
            </div>
            <div v-if="detailExpanded && !activeIssue" class="ipd-empty">
              <span class="ipd-empty-text">点击左侧高亮或上方问题查看详情</span>
            </div>
          </div>
        </div>
      </div>

      <div class="review-footer">
        <span class="review-footer-icon">💡</span>
        <span v-if="hasIssues">点击左侧高亮文本或右侧问题可定位到原文位置</span>
        <span v-else-if="isReviewPending">审查仍在处理中，当前仅展示源文</span>
        <span v-else>当前页面为只读审查结果</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Loading,
  Download,
  CircleCheckFilled,
  ArrowLeft,
  WarningFilled,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { downloadFile } from '../utils/document'
import {
  getReviewApi,
  getReviewSourceAccessApi,
  type ReviewIssue,
  type ReviewRecordData,
  type ReviewSeverity,
  type ReviewIssueStatus,
} from '../service/reviewService'
import MarkdownRenderer from '../components/MarkdownRenderer.vue'
import MarkdownIt from 'markdown-it'
import { updateReviewResultsApi } from '../service/reviewService'
import { loginToClawith, connectClawithWebSocket } from '../service/clawithService'

interface ReviewDetailRecord {
  id: string
  documentName: string
  dimensions: string[]
  standardIds: string[]
  status: string
  ossFileKey: string
  summary: Record<string, Record<string, number>> | null
  issues: ReviewIssue[]
  createdAt: string
  updatedAt: string
}

const route = useRoute()
const router = useRouter()
const recordId = computed(() => route.params.id as string)

const loading = ref(true)
const record = ref<ReviewDetailRecord | null>(null)
const notFound = ref(false)
const recordLoadError = ref('')
const issues = ref<ReviewIssue[]>([])
const sourceContent = ref('')
const sourceLoadError = ref('')
const missingSource = ref(false)
const activeIssueId = ref<string | null>(null)
const annotationAreaRef = ref<HTMLElement | null>(null)
const sourceContainerRef = ref<HTMLElement | null>(null)
const snippetMd = new MarkdownIt({ html: false })
const detailExpanded = ref(false)
const detailHeight = ref(400)
const isDragging = ref(false)
const matchNavIndex = ref<Map<string, number>>(new Map())
const failedRecordId = ref('')
const localReviewResult = ref<{ summary: any; issues: any[] } | null>(null)
const localResultSaveFailed = ref(false)
let latestLoadId = 0
let clawithWs: ReturnType<typeof connectClawithWebSocket> | null = null

onMounted(() => {
  void loadRecord().then(() => {
    void connectAndStartReview()
  })
})

watch(recordId, () => {
  void loadRecord()
})

onBeforeUnmount(() => {
  if (clawithWs) {
    clawithWs.close()
    clawithWs = null
  }
})

function startDrag(e: MouseEvent) {
  isDragging.value = true
  const startY = e.clientY
  const startHeight = detailHeight.value

  const onMove = (ev: MouseEvent) => {
    if (!isDragging.value) return
    const delta = startY - ev.clientY
    detailHeight.value = Math.max(400, Math.min(600, startHeight + delta))
  }

  const onUp = () => {
    isDragging.value = false
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
  document.body.style.cursor = 'row-resize'
  document.body.style.userSelect = 'none'
}

async function connectAndStartReview() {
  const manifestUrl = route.query.manifestUrl as string | undefined
  const clawithSessionId = route.query.clawithSessionId as string | undefined

  if (!manifestUrl || !clawithSessionId || !record.value) return

  // 非 pending/running 状态说明已有结果，不需要重新审查
  if (!inProgressReviewStatuses.has(record.value.status)) return

  let reviewResultHandled = false
  let chunkBuffer = ''

  try {
    const clawithJWT = await loginToClawith()

    clawithWs = connectClawithWebSocket(clawithJWT, clawithSessionId, (msg) => {
      // 累积 chunk 到缓冲区，尝试提取结构化 JSON
      if (msg.type === 'chunk' && msg.content) {
        chunkBuffer += msg.content as string
        const match = chunkBuffer.match(/```json\s*([\s\S]*?)```/)
        if (match) {
          try {
            const result = JSON.parse(match[1])
            if (result.summary && Array.isArray(result.issues) && !reviewResultHandled) {
              reviewResultHandled = true
              handleReviewResult(result)
            }
          } catch {
            // JSON 可能不完整，等待下一个 chunk
          }
          // 提取后截断缓冲区，避免无限增长
          chunkBuffer = chunkBuffer.slice(match.index! + match[0].length)
        }
      }
    })

    // 发送审查指令（连接建立后自动排队发送）
    const prompt = buildReviewPrompt(manifestUrl)
    clawithWs.send(prompt)
  } catch (error) {
    console.error('[Clawith] 连接失败:', error)
  }
}

function buildReviewPrompt(manifestUrl: string): string {
  return `请对设计文档进行规范审查。

manifest_url: ${manifestUrl}

执行步骤：
1. 访问 manifest_url 获取审查任务详情
2. 下载源文件和规范包到 /tmp/archspec-review/
3. 按维度逐段审查，结合规范条文判断
4. 审查完成后，在最后一条消息中以代码块输出结构化 JSON 结果：
\`\`\`json
{
  "summary": {
    "bySeverity": { "critical": 0, "warning": 0, "suggestion": 0 },
    "byDimension": { "compliance": 0, "terminology": 0, "completeness": 0, "consistency": 0 }
  },
  "issues": [
    {
      "severity": "critical",
      "dimension": "compliance",
      "title": "问题标题（简短概括）",
      "description": "详细问题描述",
      "originalSnippet": "原文中有问题的片段",
      "snippetStart": 0,
      "chapterRef": "所在章节名称",
      "standardRef": "GB xxxxx-xxxx",
      "standardClause": "x.x.x",
      "standardText": "规范条文原文",
      "suggestionText": "具体修改建议"
    }
  ]
}
\`\`\``
}

async function handleReviewResult(data: { summary: any; issues: any[] }) {
  // 先保存本地结果，确保页面能展示
  localReviewResult.value = data

  try {
    await updateReviewResultsApi(recordId.value, {
      summary: JSON.stringify(data.summary),
      issues: data.issues,
    })
    ElMessage.success('审查完成')
    await loadRecord(recordId.value)
  } catch (error) {
    console.error('写入审查结果失败:', error)
    localResultSaveFailed.value = true
    ElMessage.warning('审查结果已接收，但保存失败，可点击"重试保存"')
    applyLocalResults()
  }
}

/** 将本地缓存的结果应用到当前页面展示 */
function applyLocalResults() {
  const data = localReviewResult.value
  if (!data || !record.value) return
  // 将本地结果映射为 ReviewIssue[] 用于展示
  const mappedIssues: ReviewIssue[] = (data.issues || []).map((item: any, idx: number) => ({
    id: item.id || `local-issue-${idx}`,
    severity: item.severity || 'warning',
    dimension: item.dimension || 'compliance',
    title: item.title || '',
    description: item.description || '',
    originalSnippet: item.originalSnippet || '',
    snippetStart: item.snippetStart ?? undefined,
    chapterRef: item.chapterRef || '',
    standardRef: item.standardRef || '',
    standardClause: item.standardClause || '',
    standardText: item.standardText || '',
    suggestionText: item.suggestionText || '',
    status: 'pending' as const,
  }))
  issues.value = mappedIssues
  activeIssueId.value = mappedIssues[0]?.id || null
  detailExpanded.value = mappedIssues.length > 0
  // 临时标记为已完成状态用于展示
  record.value = { ...record.value, status: 'completed' }
}

async function retrySaveResults() {
  if (!localReviewResult.value) return
  localResultSaveFailed.value = false
  try {
    await updateReviewResultsApi(recordId.value, {
      summary: JSON.stringify(localReviewResult.value.summary),
      issues: localReviewResult.value.issues,
    })
    ElMessage.success('审查结果已保存')
    await loadRecord(recordId.value)
  } catch (error) {
    console.error('重试保存失败:', error)
    localResultSaveFailed.value = true
    ElMessage.error('保存失败，请稍后重试')
  }
}

async function loadRecord(targetId = recordId.value) {
  const loadId = ++latestLoadId
  const id = targetId
  loading.value = true
  clearLoadedRecordState()
  notFound.value = false
  recordLoadError.value = ''
  failedRecordId.value = id

  try {
    const detail = await getReviewApi(id)
    if (loadId !== latestLoadId || id !== recordId.value) return
    const normalized = mapRecord(detail)
    record.value = normalized
    issues.value = isTerminalReviewStatus(normalized.status) ? normalized.issues.map(issue => ({ ...issue })) : []
    activeIssueId.value = issues.value[0]?.id || null
    detailExpanded.value = issues.value.length > 0

    if (!normalized.ossFileKey.trim()) {
      missingSource.value = true
      return
    }

    const sourceState = await loadSourceText(id)
    if (loadId !== latestLoadId || id !== recordId.value) return
    if (sourceState.notFound) {
      clearLoadedRecordState()
      notFound.value = true
      return
    }
    sourceContent.value = sourceState.content
    missingSource.value = sourceState.missingSource
    sourceLoadError.value = sourceState.errorMessage
  } catch (error) {
    if (loadId !== latestLoadId || id !== recordId.value) return
    if (isReviewNotFoundError(error)) {
      clearLoadedRecordState()
      notFound.value = true
    } else {
      recordLoadError.value = getErrorMessage(error, '加载审查结果失败')
    }
  } finally {
    if (loadId !== latestLoadId || id !== recordId.value) return
    loading.value = false
  }
}

function mapRecord(data: ReviewRecordData): ReviewDetailRecord {
  return {
    id: data.id,
    documentName: data.documentName,
    dimensions: normalizeStringArray(data.dimensions),
    standardIds: normalizeStringArray(data.standardIds),
    status: data.status || 'pending',
    ossFileKey: (data.ossFileKey || '').trim(),
    summary: (data.summary && typeof data.summary === 'object' && !Array.isArray(data.summary))
      ? data.summary as unknown as Record<string, Record<string, number>>
      : null,
    issues: Array.isArray(data.issues) ? data.issues.map(issue => ({ ...issue })) : [],
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

function normalizeStringArray(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function loadSourceText(id: string): Promise<{
  content: string
  missingSource: boolean
  errorMessage: string
  notFound: boolean
}> {
  try {
    const sourceAccess = await getReviewSourceAccessApi(id)
    return {
      content: await fetchSourceTextFromAccess(id, sourceAccess.accessUrl),
      missingSource: false,
      errorMessage: '',
      notFound: false,
    }
  } catch (error) {
    if (isMissingSourceError(error)) {
      return {
        content: '',
        missingSource: true,
        errorMessage: '',
        notFound: false,
      }
    }
    if (isReviewNotFoundError(error)) {
      return {
        content: '',
        missingSource: false,
        errorMessage: '',
        notFound: true,
      }
    }
    return {
      content: '',
      missingSource: false,
      errorMessage: getErrorMessage(error, '获取源文件访问地址失败'),
      notFound: false,
    }
  }
}

function clearLoadedRecordState() {
  record.value = null
  issues.value = []
  sourceContent.value = ''
  sourceLoadError.value = ''
  missingSource.value = false
  activeIssueId.value = null
  detailExpanded.value = false
  matchNavIndex.value = new Map()
}

async function fetchSourceTextFromAccess(id: string, accessUrl: string): Promise<string> {
  if (!accessUrl) {
    throw new Error('缺少可回显源文件')
  }
  try {
    return await fetchSourceText(accessUrl)
  } catch {
    const retryAccess = await getReviewSourceAccessApi(id)
    if (!retryAccess.accessUrl) {
      throw new Error('缺少可回显源文件')
    }
    return await fetchSourceText(retryAccess.accessUrl)
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function isReviewNotFoundError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'reviewNotFound' in error)
}

function isMissingSourceError(error: unknown): boolean {
  const message = getErrorMessage(error, String(error || ''))
  return message.includes('ossFileKey') || message.includes('缺少可回显源文件')
}

async function fetchSourceText(accessUrl: string): Promise<string> {
  let response: Response
  try {
    response = await fetch(accessUrl)
  } catch {
    throw new Error('源文件读取失败，请刷新后重试')
  }

  if (!response.ok) {
    throw new Error(`源文件读取失败 (${response.status})`)
  }

  return await response.text()
}

const completedReviewStatuses = new Set(['completed', 'all_handled'])
const inProgressReviewStatuses = new Set(['pending', 'processing', 'running'])
const isReviewPending = computed(() => Boolean(record.value && inProgressReviewStatuses.has(record.value.status)))
const isReviewCompleted = computed(() => Boolean(record.value && completedReviewStatuses.has(record.value.status)))
const isReviewFailed = computed(() => record.value?.status === 'failed')
const visibleIssues = computed(() => (isReviewCompleted.value ? issues.value : []))
const hasIssues = computed(() => visibleIssues.value.length > 0)
const hasRenderableSource = computed(() => !missingSource.value && !sourceLoadError.value && sourceContent.value.length > 0)
const totalIssuesCount = computed(() => visibleIssues.value.length)
const pendingIssuesCount = computed(() => visibleIssues.value.filter(i => i.status === 'pending').length)
const resolvedIssuesCount = computed(() => visibleIssues.value.filter(i => i.status === 'resolved').length)
const ignoredIssuesCount = computed(() => visibleIssues.value.filter(i => i.status === 'ignored').length)

const summaryStateClass = computed(() => ({
  'review-summary--pending': isReviewPending.value,
  'review-summary--failed': isReviewFailed.value,
  'review-summary--completed': isReviewCompleted.value,
}))

const summaryEmptyStateClass = computed(() => ({
  'review-summary-empty--pending': isReviewPending.value,
  'review-summary-empty--failed': isReviewFailed.value,
}))

const annotationNoticeClass = computed(() => ({
  'review-inline-empty--pending': isReviewPending.value,
  'review-inline-empty--failed': isReviewFailed.value,
}))

const issuePanelEmptyClass = computed(() => ({
  'issue-panel-empty--pending': isReviewPending.value,
  'issue-panel-empty--failed': isReviewFailed.value,
}))

const summaryIconColor = computed(() => {
  if (isReviewCompleted.value) return 'var(--success-color)'
  if (isReviewFailed.value) return 'var(--danger-color)'
  return 'var(--warning-color)'
})

const dimLabels = computed(() => {
  if (!record.value) return ''
  return record.value.dimensions.map((d) => ({
    compliance: '规范符合性',
    completeness: '完整性检查',
    terminology: '术语规范性',
  }[d] || d)).join('、')
})

const summaryStatusText = computed(() => {
  if (!record.value) return '审查结果'
  if (isReviewPending.value) return '审查处理中'
  if (isReviewCompleted.value) return '审查完成'
  if (record.value.status === 'failed') return '审查失败'
  return '审查结果'
})

const summaryEmptyText = computed(() => {
  if (isReviewPending.value) return '审查仍在处理中，暂无最终结论'
  if (isReviewFailed.value) return '审查失败，暂未生成结果'
  return '未发现规范问题'
})

const sourcePanelHint = computed(() => {
  if (missingSource.value) return '该记录缺少可回显源文件'
  if (sourceLoadError.value) return '源文件未能成功加载'
  if (isReviewPending.value) return '审查仍在处理中，原文仅供查看'
  if (!hasIssues.value) return '当前内容未发现规范问题'
  return '点击高亮文本查看详情'
})

const annotationNotice = computed(() => {
  if (missingSource.value || sourceLoadError.value) return ''
  if (isReviewPending.value) return '审查仍在处理中，完成后将展示规范问题'
  if (isReviewFailed.value) return '审查失败，暂无可用结果'
  if (!hasIssues.value) return '未发现规范问题'
  if (pendingIssuesCount.value === 0) return `共 ${totalIssuesCount.value} 个问题，已全部标记为已处理或已忽略`
  return ''
})

const issuePanelEmptyText = computed(() => {
  if (isReviewPending.value) return '审查仍在处理中，完成后将显示问题清单'
  if (isReviewFailed.value) return '审查失败，暂无可展示的问题'
  return '当前没有可展示的问题'
})

const sortedIssues = computed(() => {
  const weight: Record<string, number> = { critical: 0, warning: 1, suggestion: 2, terminology: 3 }
  return [...visibleIssues.value].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1
    if (a.status !== 'pending' && b.status === 'pending') return 1
    return (weight[a.severity] || 99) - (weight[b.severity] || 99)
  })
})

const severityStats = computed(() => {
  const keys: { key: ReviewSeverity; label: string }[] = [
    { key: 'critical', label: '严重' },
    { key: 'warning', label: '警告' },
    { key: 'suggestion', label: '建议' },
  ]
  const bySeverity = record.value?.summary?.bySeverity || {}
  // 如果 summary 有数据，直接使用；否则从 issues 兜底计算
  if (Object.keys(bySeverity).length > 0) {
    return keys.map(k => ({
      ...k,
      count: (bySeverity as Record<string, number>)[k.key] ?? 0,
    }))
  }
  return keys.map(k => ({
    ...k,
    count: visibleIssues.value.filter(i => i.severity === k.key).length,
  }))
})

const activeIssue = computed(() =>
  visibleIssues.value.find(i => i.id === activeIssueId.value),
)

function applyHighlights() {
  const container = sourceContainerRef.value
  if (!container) return

  // Remove existing highlight spans, unwrapping text
  const existingHighlights = container.querySelectorAll('.review-highlight')
  existingHighlights.forEach(el => {
    const parent = el.parentNode
    if (!parent) return
    const tag = el.querySelector('.review-highlight-tag')
    if (tag) tag.remove()
    while (el.firstChild) {
      parent.insertBefore(el.firstChild, el)
    }
    parent.removeChild(el)
  })
  container.normalize()

  for (const issue of visibleIssues.value) {
    const rawSnippet = issue.originalSnippet || ''
    const cleanSnippet = rawSnippet.replace(/^\.\.\./, '').replace(/\.\.\.$/, '')
    if (!cleanSnippet) continue

    const snippetHtml = snippetMd.render(cleanSnippet)
    const tmp = document.createElement('div')
    tmp.innerHTML = snippetHtml
    const plainSnippet = tmp.textContent || ''
    if (!plainSnippet) continue

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
    const textNodes: Text[] = []
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode as Text)
    }

    for (const node of textNodes) {
      const content = node.textContent || ''
      const idx = content.indexOf(plainSnippet)
      if (idx === -1) continue

      const range = document.createRange()
      range.setStart(node, idx)
      range.setEnd(node, idx + plainSnippet.length)

      const highlightSpan = document.createElement('span')
      highlightSpan.className = `review-highlight severity-${issue.severity} issue-${issue.id}`
      if (activeIssueId.value === issue.id) {
        highlightSpan.classList.add('is-focused')
      }
      highlightSpan.addEventListener('click', () => focusIssue(issue.id))

      const tagSpan = document.createElement('span')
      tagSpan.className = `review-highlight-tag tag-${issue.severity}`
      tagSpan.textContent = severityLabel(issue.severity)

      range.surroundContents(highlightSpan)
      highlightSpan.appendChild(tagSpan)
      break
    }
  }
}

watch([sourceContent, visibleIssues], () => {
  nextTick(() => applyHighlights())
})

function isTerminalReviewStatus(status: string): boolean {
  return completedReviewStatuses.has(status)
}

function severityLabel(severity: ReviewSeverity): string {
  return { critical: '严重', warning: '警告', suggestion: '建议', terminology: '术语' }[severity] || severity
}

function issueStatusLabel(status: ReviewIssueStatus): string {
  return { pending: '待处理', resolved: '已处理', ignored: '已忽略' }[status] || status
}

function getMatchCount(clauseId: string): number {
  return visibleIssues.value.filter(i => i.clauseId === clauseId).length
}

function navigateMatch(issue: ReviewIssue) {
  if (!issue.clauseId) return
  const siblings = visibleIssues.value.filter(i => i.clauseId === issue.clauseId)
  if (siblings.length === 0) return
  if (siblings.length === 1) {
    focusIssue(siblings[0].id)
    return
  }
  const map = matchNavIndex.value
  const current = map.get(issue.clauseId) || 0
  const next = (current + 1) % siblings.length
  map.set(issue.clauseId, next)
  matchNavIndex.value = new Map(map)
  focusIssue(siblings[next].id)
}

function getMatchNavLabel(issue: ReviewIssue): string {
  if (!issue.clauseId) return ''
  const total = getMatchCount(issue.clauseId)
  if (total <= 1) return `${total}处`
  const current = (matchNavIndex.value.get(issue.clauseId) || 0) + 1
  return `‹ ${current}/${total} ›`
}

function goToList() {
  router.push('/review')
}

function retryLoadRecord() {
  if (!failedRecordId.value) return
  void loadRecord(failedRecordId.value)
}

function focusIssue(issueId: string) {
  activeIssueId.value = issueId
  nextTick(() => {
    const container = sourceContainerRef.value || annotationAreaRef.value
    if (!container) return
    container.querySelectorAll('.review-highlight.is-focused').forEach(el => {
      el.classList.remove('is-focused')
    })
    const activeEl = container.querySelector(`.issue-${issueId}`)
    if (activeEl) {
      activeEl.classList.add('is-focused')
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}

function navigateToClause(issue: ReviewIssue) {
  if (!issue.clauseId) return
  const url = router.resolve({
    path: '/clauses',
    query: {
      standardId: issue.standardId || '',
      clauseId: issue.clauseId || '',
    },
  })
  window.open(url.href, '_blank')
}

function exportReport() {
  if (!isReviewCompleted.value) {
    ElMessage.warning('审查仍在处理中，完成后再导出报告')
    return
  }

const lines: string[] = [
    '# 规范审查报告',
    '',
    `**文档名称**：${record.value?.documentName || ''}`,
    `**审查日期**：${new Date().toLocaleDateString('zh-CN')}`,
    `**审查维度**：${dimLabels.value || '未设置'}`,
    '',
    '---',
    '',
    '## 审查概览',
    '',
    `| 类型 | 数量 |`,
    `|------|------|`,
    `| 严重问题 | ${visibleIssues.value.filter(i => i.severity === 'critical').length} |`,
    `| 警告 | ${visibleIssues.value.filter(i => i.severity === 'warning').length} |`,
    `| 建议 | ${visibleIssues.value.filter(i => i.severity === 'suggestion').length} |`,
    `| **合计** | **${visibleIssues.value.length}** |`,
    '',
    `**处理状态**：待处理 ${pendingIssuesCount.value} / 已处理 ${resolvedIssuesCount.value} / 已忽略 ${ignoredIssuesCount.value}`,
    missingSource.value ? '**源文件状态**：缺少可回显源文件' : '',
    sourceLoadError.value ? `**源文件状态**：${sourceLoadError.value}` : '',
    '',
    '---',
    '',
    '## 问题清单',
    '',
  ].filter(Boolean)

  visibleIssues.value.forEach((issue, idx) => {
    const sevLabel = severityLabel(issue.severity)
    lines.push(`### ${idx + 1}. [${sevLabel}] ${issue.title}`)
    lines.push('')
    lines.push(`- **严重级别**：${sevLabel}`)
    lines.push(`- **审查维度**：${issue.dimension === 'compliance' ? '规范符合性' : issue.dimension === 'completeness' ? '完整性检查' : '术语规范性'}`)
    if (issue.chapterRef) lines.push(`- **原文位置**：${issue.chapterRef}`)
    lines.push(`- **问题描述**：${issue.description}`)
    if (issue.originalSnippet) lines.push(`- **原文片段**："${issue.originalSnippet}"`)
    if (issue.standardRef) lines.push(`- **违反规范**：${issue.standardRef}${issue.standardClause ? ` 第${issue.standardClause}条` : ''}`)
    if (issue.standardText) lines.push(`- **规范原文**："${issue.standardText}"`)
    if (issue.suggestionText) lines.push(`- **修改建议**：${issue.suggestionText}`)
    lines.push(`- **状态**：${issueStatusLabel(issue.status)}`)
    lines.push('')
  })

  const reportContent = lines.join('\n')
  const fileName = `规范审查报告_${new Date().toISOString().slice(0, 10)}.md`
  downloadFile(reportContent, fileName, 'text/markdown')
  ElMessage.success('审查报告已导出')
}
</script>


<style scoped>
/* ===== 整体 ===== */
.review-result-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--gray-50);
}

/* ===== 加载/未找到 ===== */
.review-loading-state,
.review-not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 12px;
  color: var(--gray-500);
}

.review-load-error-actions {
  display: flex;
  gap: 12px;
}

.review-not-found h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--gray-700);
  margin: 0;
}

/* ===== 顶部工具栏 ===== */
.review-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 52px;
  background: white;
  border-bottom: 1px solid var(--gray-200);
  flex-shrink: 0;
}

.review-toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.review-toolbar-divider {
  width: 1px;
  height: 18px;
  background: var(--gray-200);
  flex-shrink: 0;
}

.review-toolbar-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0;
  white-space: nowrap;
}

.review-toolbar-docname {
  font-size: 13px;
  color: var(--gray-500);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.review-toolbar-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

/* ===== 审查概况 ===== */
.review-summary {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 20px;
  background: #F0FDF4;
  border-bottom: 1px solid #BBF7D0;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.review-summary--pending {
  background: #FFFBEB;
  border-bottom-color: #FDE68A;
}

.review-summary--failed {
  background: #FEF2F2;
  border-bottom-color: #FECACA;
}

.review-summary-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #166534;
  white-space: nowrap;
}

.review-summary--pending .review-summary-header {
  color: #92400E;
}

.review-summary--failed .review-summary-header {
  color: #B91C1C;
}

.review-summary-dims {
  font-size: 12px;
  color: #15803D;
  white-space: nowrap;
}

.review-summary--pending .review-summary-dims {
  color: #B45309;
}

.review-summary--failed .review-summary-dims {
  color: #B91C1C;
}

.review-summary-stats {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.rs-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  white-space: nowrap;
}

.rs-dot { width: 6px; height: 6px; border-radius: 50%; }
.rs-critical .rs-dot { background: #EF4444; }
.rs-warning .rs-dot { background: #F59E0B; }
.rs-suggestion .rs-dot { background: #10B981; }
.rs-terminology .rs-dot { background: #3B82F6; }

.rs-count { font-weight: 700; }
.rs-critical .rs-count { color: #EF4444; }
.rs-warning .rs-count { color: #B45309; }
.rs-suggestion .rs-count { color: #15803D; }
.rs-terminology .rs-count { color: #1D4ED8; }
.rs-pending .rs-count { color: var(--gray-700); }
.rs-resolved .rs-count { color: #16A34A; }
.rs-ignored .rs-count { color: var(--gray-400); }

.rs-label { color: var(--gray-500); }
.rs-divider { width: 1px; height: 14px; background: #BBF7D0; }

.review-summary-empty {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #15803D;
  margin-left: auto;
}

.review-summary-empty--pending {
  color: #92400E;
}

.review-summary-empty--failed {
  color: #B91C1C;
}

.review-summary-note {
  font-size: 12px;
  color: #92400E;
  background: #FFFBEB;
  border: 1px solid #FDE68A;
  border-radius: 999px;
  padding: 4px 10px;
}

.review-summary-note-error {
  color: #B91C1C;
  background: #FEF2F2;
  border-color: #FECACA;
}

/* ===== 保存失败提示条 ===== */
.review-save-failed-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  background: #FEF2F2;
  border-bottom: 1px solid #FECACA;
  color: #B91C1C;
  font-size: 13px;
  flex-shrink: 0;
}

/* ===== 主体 ===== */
.review-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* ===== 左栏：原文批注 ===== */
.review-annotation-area {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
  background: white;
  position: relative;
  min-width: 0;
}

.review-annotation-header {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--gray-400);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--gray-100);
}

.review-hint {
  font-weight: 400;
  color: var(--gray-400);
  text-transform: none;
  letter-spacing: 0;
  flex: 1;
}

.review-inline-empty {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 16px;
  padding: 8px 12px;
  border-radius: 8px;
  background: #F0FDF4;
  border: 1px solid #BBF7D0;
  color: #166534;
  font-size: 12px;
}

.review-inline-empty--pending {
  background: #FFFBEB;
  border-color: #FDE68A;
  color: #92400E;
}

.review-inline-empty--failed {
  background: #FEF2F2;
  border-color: #FECACA;
  color: #B91C1C;
}

.review-edit-toggle {
  text-transform: none;
  letter-spacing: 0;
}

/* 编辑模式 */
.review-content-edit {
  margin-bottom: 16px;
}

.review-edit-textarea {
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.7;
}

.review-edit-textarea :deep(.el-textarea__inner) {
  min-height: 400px;
}

.review-content-edit-hint {
  font-size: 12px;
  color: var(--gray-400);
  margin-top: 8px;
  line-height: 1.4;
}

/* 批注文本 */
.review-annotation-text {
  font-size: 14px;
  line-height: 2;
  color: var(--gray-800);
  white-space: pre-wrap;
  word-break: break-word;
}

.review-annotation-md {
  padding: 4px 0;
}

.review-source-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 260px;
  text-align: center;
  gap: 10px;
  color: var(--gray-500);
  border: 1px dashed var(--gray-200);
  border-radius: 12px;
  background: var(--gray-50);
  padding: 32px 24px;
}

.review-source-state-missing {
  color: #92400E;
  background: #FFFBEB;
  border-color: #FDE68A;
}

.review-source-state-error {
  color: #B91C1C;
  background: #FEF2F2;
  border-color: #FECACA;
}

.review-source-title {
  font-size: 18px;
  font-weight: 600;
  color: inherit;
  margin: 0;
}

.review-source-desc {
  font-size: 13px;
  line-height: 1.6;
  max-width: 420px;
  margin: 0;
}

.review-highlight {
  position: relative;
  cursor: pointer;
  padding: 1px 2px;
  border-radius: 3px;
  transition: all 0.15s ease;
  display: inline;
  white-space: pre-wrap;
}

.review-highlight:hover {
  filter: brightness(0.95);
  box-shadow: 0 0 0 2px rgba(0,0,0,0.08);
}

.review-highlight.severity-critical { background: #FEF2F2; border-bottom: 2px solid #EF4444; }
.review-highlight.severity-warning { background: #FFFBEB; border-bottom: 2px solid #F59E0B; }
.review-highlight.severity-suggestion { background: #F0FDF4; border-bottom: 2px solid #10B981; }
.review-highlight.severity-terminology { background: #EFF6FF; border-bottom: 2px solid #3B82F6; }

.review-highlight-tag {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-weight: 600;
  padding: 0 5px;
  height: 16px;
  border-radius: 3px;
  margin-left: 4px;
  vertical-align: middle;
  position: relative;
  top: -1px;
}

.tag-critical { background: #EF4444; color: white; }
.tag-warning { background: #F59E0B; color: white; }
.tag-suggestion { background: #10B981; color: white; }
.tag-terminology { background: #3B82F6; color: white; }

/* 高亮聚焦 */
.review-highlight.is-focused {
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.4);
  filter: brightness(1.05);
}

/* 统计浮标 */
.review-stats-float {
  position: sticky;
  bottom: 0;
  left: 0;
  display: inline-flex;
  align-items: center;
  gap: 14px;
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: 10px;
  padding: 8px 18px;
  margin-top: 24px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.stats-float-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
}

.stats-dot { width: 7px; height: 7px; border-radius: 50%; }
.stats-critical .stats-dot { background: #EF4444; }
.stats-warning .stats-dot { background: #F59E0B; }
.stats-suggestion .stats-dot { background: #10B981; }
.stats-terminology .stats-dot { background: #3B82F6; }
.stats-count { font-weight: 700; font-size: 14px; }
.stats-critical .stats-count { color: #EF4444; }
.stats-warning .stats-count { color: #F59E0B; }
.stats-suggestion .stats-count { color: #10B981; }
.stats-terminology .stats-count { color: #3B82F6; }
.stats-label { color: var(--gray-500); }

/* 空状态 */
.review-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  padding: 40px 20px;
}

.review-empty-icon { margin-bottom: 16px; }
.review-empty-title { font-size: 18px; font-weight: 600; color: var(--gray-900); margin: 0 0 8px; }
.review-empty-desc { font-size: 13px; color: var(--gray-500); margin: 0 0 24px; max-width: 320px; line-height: 1.6; }

/* ===== 右侧问题清单 ===== */
.review-issue-panel {
  width: 380px;
  display: flex;
  flex-direction: column;
  background: white;
  border-left: 1px solid var(--gray-200);
  flex-shrink: 0;
  overflow: hidden;
}

.issue-panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--gray-200);
  flex-shrink: 0;
}

.issue-panel-title { font-size: 14px; font-weight: 600; color: var(--gray-900); }

.issue-panel-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--primary-color);
  color: white;
  font-size: 11px;
  font-weight: 600;
}

.issue-panel-summary {
  display: flex;
  gap: 14px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--gray-100);
  background: var(--gray-50);
  flex-shrink: 0;
}

.ips-item { display: flex; align-items: baseline; gap: 3px; font-size: 12px; }
.ips-count { font-weight: 700; font-size: 15px; }
.ips-label { color: var(--gray-500); font-size: 11px; }
.ips-critical .ips-count { color: #EF4444; }
.ips-warning .ips-count { color: #F59E0B; }
.ips-suggestion .ips-count { color: #10B981; }
.ips-terminology .ips-count { color: #3B82F6; }

/* ===== 问题列表 ===== */
.issue-panel-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.issue-panel-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  border: 1px dashed var(--gray-200);
  border-radius: 8px;
  color: var(--gray-400);
  font-size: 12px;
  background: var(--gray-50);
}

.issue-panel-empty--pending {
  border-color: #FDE68A;
  background: #FFFBEB;
  color: #92400E;
}

.issue-panel-empty--failed {
  border-color: #FECACA;
  background: #FEF2F2;
  color: #B91C1C;
}

.issue-item {
  padding: 10px 12px;
  margin-bottom: 6px;
  border-radius: 8px;
  border: 1px solid var(--gray-200);
  border-left: 3px solid var(--gray-300);
  cursor: pointer;
  transition: all 0.12s ease;
  background: white;
}

.issue-item:hover { background: var(--gray-50); }

.issue-item.is-active {
  border-color: var(--primary-color);
  border-left-width: 3px;
  background: #EFF6FF;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

.issue-item.is-done { opacity: 0.55; }
.issue-item.sev-critical { border-left-color: #EF4444; }
.issue-item.sev-warning { border-left-color: #F59E0B; }
.issue-item.sev-suggestion { border-left-color: #10B981; }
.issue-item.sev-terminology { border-left-color: #3B82F6; }

.issue-item-top {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
}

.issue-item-sev {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 3px;
  flex-shrink: 0;
}
.sev-critical .issue-item-sev { background: #FEF2F2; color: #EF4444; }
.sev-warning .issue-item-sev { background: #FFFBEB; color: #B45309; }
.sev-suggestion .issue-item-sev { background: #F0FDF4; color: #15803D; }
.sev-terminology .issue-item-sev { background: #EFF6FF; color: #1D4ED8; }

.issue-item-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--gray-800);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.issue-item-spacer {
  flex: 1;
}

/* 匹配次数标签 */
.issue-item-count {
  flex-shrink: 0;
  cursor: pointer;
  user-select: none;
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  font-weight: 600;
  color: var(--primary-color);
  background: #EFF6FF;
  border: 1px solid #BFDBFE;
  padding: 0 7px;
  height: 18px;
  line-height: 16px;
  border-radius: 9px;
  transition: all 0.12s ease;
}

.issue-item-count:hover {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
}

.issue-item-count.has-multi {
  padding: 0 5px;
  min-width: 44px;
  text-align: center;
  letter-spacing: 0.3px;
}

.issue-item-desc {
  font-size: 12px;
  color: var(--gray-500);
  line-height: 1.4;
  margin-top: 2px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.issue-item-ref {
  font-size: 11px;
  color: var(--gray-400);
  margin-top: 4px;
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
}

/* 问题项操作栏 */
.issue-item-main { cursor: pointer; }

.issue-item-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid var(--gray-100);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.issue-item:hover .issue-item-actions { opacity: 1; }
.issue-item.is-done .issue-item-actions { display: none; }
.issue-item-actions .el-button { font-size: 11px; padding: 0 5px; height: 22px; }

/* ===== 底部详情区（可折叠） ===== */
.issue-panel-detail {
  border-top: 1px solid var(--gray-200);
  flex-shrink: 0;
  background: white;
}

.ipd-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  cursor: pointer;
  user-select: none;
  transition: background 0.12s;
}

.ipd-toggle:hover {
  background: var(--gray-50);
}

.ipd-toggle-arrow {
  font-size: 10px;
  color: var(--gray-400);
  flex-shrink: 0;
}

.ipd-toggle-text {
  font-size: 12px;
  font-weight: 600;
  color: var(--gray-600);
}

.ipd-toggle-preview {
  font-size: 11px;
  color: var(--gray-400);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-left: auto;
  max-width: 180px;
}

.ipd-body {
  padding: 0 16px 12px;
  max-height: 200px;
  overflow-y: auto;
}

/* 拖拽手柄 */
.ipd-drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 0;
  cursor: row-resize;
  user-select: none;
  border-top: 1px solid var(--gray-200);
  transition: background 0.12s;
}

.ipd-drag-handle:hover {
  background: var(--gray-100);
}

.ipd-drag-handle:active {
  background: var(--gray-200);
}

.ipd-drag-dot {
  display: block;
  width: 20px;
  height: 3px;
  border-radius: 2px;
  background: var(--gray-300);
}

.ipd-drag-handle:hover .ipd-drag-dot {
  background: var(--gray-400);
}

.ipd-empty { display: flex; align-items: center; justify-content: center; min-height: 60px; }
.ipd-empty-text { font-size: 12px; color: var(--gray-400); }
.ipd-block { margin-bottom: 8px; padding: 8px 10px; background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: 6px; }
.ipd-block-suggestion { background: #EFF6FF; border-color: #BFDBFE; }
.ipd-label { font-size: 10px; font-weight: 600; color: var(--gray-400); text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 3px; display: block; }
.ipd-value { font-size: 12px; color: var(--gray-700); line-height: 1.5; }
.ipd-quote { font-style: italic; color: var(--gray-600); }
.ipd-suggestion { color: #1E40AF; }
.ipd-actions { display: flex; gap: 6px; padding-top: 4px; }
.ipd-status-tag { padding-top: 4px; }

/* ===== Footer ===== */
.review-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  background: var(--gray-50);
  border-top: 1px solid var(--gray-200);
  font-size: 12px;
  color: var(--gray-500);
  flex-shrink: 0;
}

.review-footer-icon { font-size: 13px; }
.review-footer-dot { color: var(--gray-300); }
</style>
