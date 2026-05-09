<template>
  <div class="review-list-page">
    <header class="rl-header">
      <div class="rl-header-left">
        <h1 class="rl-title">规范审查</h1>
        <p class="rl-desc">查看和管理历史规范审查记录</p>
      </div>
      <el-button type="primary" size="large" :icon="Plus" @click="createReview">
        创建规范审查
      </el-button>
    </header>

    <div class="rl-metrics">
      <div class="rl-metric">
        <div class="rl-metric-icon rl-metric-icon-doc">
          <el-icon :size="20"><Document /></el-icon>
        </div>
        <div class="rl-metric-body">
          <span class="rl-metric-value">{{ totalRecords }}</span>
          <span class="rl-metric-label">总审查数</span>
        </div>
      </div>
       <div class="rl-metric rl-metric-pending">
         <div class="rl-metric-icon rl-metric-icon-warn">
           <el-icon :size="20"><WarningFilled /></el-icon>
         </div>
         <div class="rl-metric-body">
           <span class="rl-metric-value">{{ pendingReviewCount }}</span>
           <span class="rl-metric-label">当前页待处理审查</span>
         </div>
       </div>
      <div class="rl-metric">
        <div class="rl-metric-icon rl-metric-icon-clock">
          <el-icon :size="20"><Clock /></el-icon>
        </div>
        <div class="rl-metric-body">
          <span class="rl-metric-value">{{ latestDate }}</span>
          <span class="rl-metric-label">本页最新</span>
        </div>
      </div>
    </div>

    <div class="rl-toolbar">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索文件名..."
        :prefix-icon="Search"
        clearable
        class="rl-search-input"
      />
      <el-select
        v-model="statusFilter"
        placeholder="全部状态"
        clearable
        class="rl-status-select"
      >
        <el-option label="全部状态" value="" />
        <el-option label="处理中" value="processing" />
        <el-option label="已完成" value="completed" />
        <el-option label="失败" value="failed" />
      </el-select>
    </div>

    <div class="rl-body">
      <div v-if="loading" class="rl-skeleton">
        <div v-for="g in 3" :key="g" class="rl-skel-group">
          <div class="rl-skel-hdr" />
          <div v-for="c in 2" :key="c" class="rl-skel-card">
            <div class="rl-skel-accent" />
            <div class="rl-skel-body">
              <div class="rl-skel-line rl-skel-w-60" />
              <div class="rl-skel-line rl-skel-w-40" />
              <div class="rl-skel-line rl-skel-w-30" />
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="loadError" class="rl-empty rl-empty-error">
        <div class="rl-empty-graphic">
          <el-icon :size="48"><WarningFilled /></el-icon>
        </div>
        <h3 class="rl-empty-title">审查列表加载失败</h3>
        <p class="rl-empty-desc">{{ loadError }}</p>
        <el-button type="primary" @click="loadRecords">重试</el-button>
      </div>

      <div v-else-if="records.length === 0" class="rl-empty">
        <div class="rl-empty-graphic">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <rect x="8" y="12" width="64" height="56" rx="6" stroke="currentColor" stroke-width="2" fill="none"/>
            <line x1="20" y1="28" x2="60" y2="28" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <line x1="20" y1="38" x2="50" y2="38" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <line x1="20" y1="48" x2="44" y2="48" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <circle cx="62" cy="54" r="16" fill="#EFF6FF" stroke="#3B82F6" stroke-width="2"/>
            <line x1="62" y1="48" x2="62" y2="60" stroke="#3B82F6" stroke-width="2" stroke-linecap="round"/>
            <line x1="56" y1="54" x2="68" y2="54" stroke="#3B82F6" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <h3 class="rl-empty-title">暂无审查记录</h3>
        <p class="rl-empty-desc">创建您的第一次规范审查，AI 将自动比对建筑规范标准</p>
        <el-button type="primary" :icon="Plus" @click="createReview">创建规范审查</el-button>
      </div>

      <template v-else>
        <div v-for="group in groupedRecords" :key="group.label" class="rl-group">
          <div class="rl-group-header">
            <span class="rl-group-label">{{ group.label }}</span>
            <span class="rl-group-line" />
          </div>
          <div
            v-for="(record, idx) in group.items"
            :key="record.id"
            class="rl-record-card"
            :class="`rl-accent-${worstSeverity(record)}`"
            :style="{ animationDelay: idx * 0.06 + 's' }"
            @click="openRecord(record.id)"
          >
            <div class="rl-card-accent" />
            <div class="rl-card-left">
              <div class="rl-card-name">{{ record.documentName }}</div>
              <div class="rl-card-meta">
                <span>{{ formatTime(record.createdAt) }}</span>
                <span class="rl-meta-dot">·</span>
                <span>{{ formatDimensions(record.dimensions) }}</span>
              </div>
              <div class="rl-card-severity">
                <template v-for="s in severityEntries(record)" :key="s.key">
                  <span v-if="s.count > 0" class="rl-sev-pill" :class="`rl-pill-${s.key}`">
                    {{ s.count }} {{ s.label }}
                  </span>
                </template>
              </div>
            </div>
            <div class="rl-card-right">
              <span class="rl-status-dot" :class="statusMeta(record.status).dotClass" />
              <span class="rl-status-text">{{ statusMeta(record.status).label }}</span>
              <el-icon class="rl-card-arrow"><ArrowRight /></el-icon>
            </div>
          </div>
        </div>

        <div v-if="totalRecords > pageSize" class="rl-pagination">
          <el-pagination
            background
            layout="prev, pager, next"
            :current-page="page"
            :page-size="pageSize"
            :total="totalRecords"
            @current-change="handlePageChange"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, ArrowRight, WarningFilled, Clock, Document, Search } from '@element-plus/icons-vue'
import {
  getReviewListApi,
  type ReviewDimension,
  type ReviewRecordListItemData,
} from '../service/reviewService'

interface ReviewListRecord {
  id: string
  documentName: string
  dimensions: ReviewDimension[]
  severityCounts: {
    critical: number
    warning: number
    suggestion: number
  }
  createdAt: string
  updatedAt: string
  status: string
}

const router = useRouter()
const records = ref<ReviewListRecord[]>([])
const loading = ref(true)
const loadError = ref('')
const totalRecords = ref(0)
const page = ref(1)
const pageSize = ref(20)
const searchKeyword = ref('')
const statusFilter = ref('')

const filteredRecords = computed(() => {
  let result = records.value
  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.trim().toLowerCase()
    result = result.filter(r => r.documentName.toLowerCase().includes(kw))
  }
  if (statusFilter.value) {
    if (statusFilter.value === 'processing') {
      result = result.filter(r => !completedReviewStatuses.has(r.status) && r.status !== 'failed')
    } else {
      result = result.filter(r => r.status === statusFilter.value)
    }
  }
  return result
})

let latestRequestId = 0

onMounted(() => {
  void loadRecords()
})

async function loadRecords() {
  const requestId = ++latestRequestId
  loading.value = true
  loadError.value = ''
  try {
    const response = await getReviewListApi({
      page: page.value,
      pageSize: pageSize.value,
    })
    if (requestId !== latestRequestId) return
    totalRecords.value = response.total
    page.value = response.page
    pageSize.value = response.pageSize
    records.value = response.list.map(mapListItem)
  } catch (error) {
    if (requestId !== latestRequestId) return
    records.value = []
    totalRecords.value = 0
    loadError.value = error instanceof Error ? error.message : '加载审查列表失败'
  } finally {
    if (requestId !== latestRequestId) return
    loading.value = false
  }
}

function parseJsonField<T>(value: T | string | null | undefined, fallback: T): T {
  if (value == null) return fallback
  if (typeof value !== 'string') return value as T
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function normalizeStringArray(value: string[] | string | null | undefined): string[] {
  const parsed = parseJsonField<string[] | string>(value, [])
  return Array.isArray(parsed) ? parsed : []
}

function normalizeSeverityCounts(value: Record<string, number> | string | null | undefined) {
  const parsed = parseJsonField<Record<string, any> | string>(value, {})
  const summary = typeof parsed === 'object' && parsed !== null ? parsed : {}
  // nested structure from agent: { bySeverity: { critical, warning, suggestion }, byDimension: {...} }
  const bySeverity = summary.bySeverity || summary
  return {
    critical: Number(bySeverity.critical ?? 0),
    warning: Number(bySeverity.warning ?? 0),
    suggestion: Number(bySeverity.suggestion ?? 0),
  }
}

function mapListItem(item: ReviewRecordListItemData): ReviewListRecord {
  return {
    id: item.id,
    documentName: item.documentName,
    dimensions: normalizeStringArray(item.dimensions) as ReviewDimension[],
    severityCounts: normalizeSeverityCounts(item.summary),
    status: item.status || 'pending',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

const completedReviewStatuses = new Set(['completed', 'all_handled'])

const pendingReviewCount = computed(() =>
  records.value.filter(record => !completedReviewStatuses.has(record.status) && record.status !== 'failed').length,
)

const latestDate = computed(() => {
  if (records.value.length === 0) return '--'
  return records.value[0].createdAt.slice(0, 10)
})

function dimLabel(d: string): string {
  return { compliance: '规范符合性', completeness: '完整性检查', terminology: '术语规范性' }[d] || d
}

function formatDimensions(dimensions: string[]): string {
  return dimensions.length > 0 ? dimensions.map(dimLabel).join('、') : '未设置维度'
}

function severityEntries(record: ReviewListRecord) {
  const sc = record.severityCounts
  return [
    { key: 'critical', count: sc.critical, label: '严重' },
    { key: 'warning', count: sc.warning, label: '警告' },
    { key: 'suggestion', count: sc.suggestion, label: '建议' },
  ]
}

function worstSeverity(record: ReviewListRecord): string {
  const sc = record.severityCounts
  if (sc.critical > 0) return 'critical'
  if (sc.warning > 0) return 'warning'
  if (sc.suggestion > 0) return 'suggestion'
  return 'none'
}

function statusMeta(status: string) {
  if (completedReviewStatuses.has(status)) {
    return { label: '已完成', dotClass: 'rl-status-done' }
  }
  if (status === 'failed') {
    return { label: '失败', dotClass: 'rl-status-failed' }
  }
  if (status === 'processing' || status === 'running') {
    return { label: '处理中', dotClass: 'rl-status-processing' }
  }
  return { label: '审查处理中', dotClass: 'rl-status-pending' }
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface RecordGroup {
  label: string
  items: ReviewListRecord[]
}

const groupedRecords = computed(() => {
  const groups: RecordGroup[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const thisWeekStart = new Date(today)
  thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay())

  const todayItems: ReviewListRecord[] = []
  const yesterdayItems: ReviewListRecord[] = []
  const weekItems: ReviewListRecord[] = []
  const earlierItems: ReviewListRecord[] = []

  for (const record of filteredRecords.value) {
    const d = new Date(record.createdAt)
    d.setHours(0, 0, 0, 0)
    if (d.getTime() === today.getTime()) {
      todayItems.push(record)
    } else if (d.getTime() === yesterday.getTime()) {
      yesterdayItems.push(record)
    } else if (d >= thisWeekStart) {
      weekItems.push(record)
    } else {
      earlierItems.push(record)
    }
  }

  if (todayItems.length) groups.push({ label: '今天', items: todayItems })
  if (yesterdayItems.length) groups.push({ label: '昨天', items: yesterdayItems })
  if (weekItems.length) groups.push({ label: '本周', items: weekItems })
  if (earlierItems.length) groups.push({ label: '更早', items: earlierItems })

  return groups
})

function createReview() {
  router.push({ path: '/review/new' })
}

function openRecord(id: string) {
  window.open(router.resolve({ path: `/review/${id}` }).href, '_blank')
}

function handlePageChange(nextPage: number) {
  page.value = nextPage
  void loadRecords()
}
</script>

<style scoped>
.review-list-page {
  flex: 1;
  overflow-y: auto;
  width: 100%;
  box-sizing: border-box;
}

.rl-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
  gap: 16px;
}

.rl-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--gray-900);
  margin: 0 0 6px;
  letter-spacing: -0.3px;
}

.rl-desc {
  font-size: 14px;
  color: var(--gray-500);
  margin: 0;
}

.rl-metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.rl-metric {
  display: flex;
  align-items: center;
  gap: 14px;
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: 12px;
  padding: 18px 20px;
  transition: all 0.2s ease;
}

.rl-metric:hover {
  border-color: var(--gray-300);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.rl-metric-pending {
  background: #FFFDF5;
  border-color: #FEF3C7;
}

.rl-metric-pending:hover {
  border-color: #FDE68A;
  box-shadow: 0 4px 14px rgba(245, 158, 11, 0.08);
}

.rl-metric-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  flex-shrink: 0;
}

.rl-metric-icon-doc {
  background: #EEF2FF;
  color: #4F46E5;
}

.rl-metric-icon-warn {
  background: #FEF3C7;
  color: #D97706;
}

.rl-metric-pending .rl-metric-icon-warn {
  background: #FEF3C7;
  color: #D97706;
}

.rl-metric-icon-clock {
  background: #F0FDF4;
  color: #059669;
}

.rl-metric-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.rl-metric-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--gray-900);
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.rl-metric-pending .rl-metric-value {
  color: #D97706;
}

.rl-metric-label {
  font-size: 12px;
  color: var(--gray-500);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 搜索/筛选工具栏 */
.rl-toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.rl-search-input {
  width: 260px;
  flex-shrink: 0;
}

.rl-status-select {
  width: 130px;
  flex-shrink: 0;
}

.rl-skeleton {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.rl-skel-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rl-skel-hdr {
  width: 60px;
  height: 14px;
  border-radius: 4px;
  background: var(--gray-200);
  margin-bottom: 4px;
  animation: rl-shimmer 1.5s ease infinite;
}

.rl-skel-card {
  display: flex;
  gap: 0;
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: 10px;
  overflow: hidden;
}

.rl-skel-accent {
  width: 3px;
  background: var(--gray-200);
  flex-shrink: 0;
}

.rl-skel-body {
  flex: 1;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rl-skel-line {
  height: 12px;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--gray-100) 25%, var(--gray-200) 50%, var(--gray-100) 75%);
  background-size: 200% 100%;
  animation: rl-shimmer 1.5s ease infinite;
}

.rl-skel-w-60 { width: 60%; }
.rl-skel-w-40 { width: 40%; }
.rl-skel-w-30 { width: 30%; }

@keyframes rl-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.rl-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: 12px;
  text-align: center;
}

.rl-empty-graphic {
  margin-bottom: 20px;
  color: var(--gray-300);
}

.rl-empty-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0 0 8px;
}

.rl-empty-desc {
  font-size: 14px;
  color: var(--gray-500);
  margin: 0 0 24px;
  max-width: 360px;
  line-height: 1.6;
}

.rl-empty-error {
  color: #B91C1C;
}

.rl-group {
  margin-bottom: 24px;
  animation: rl-fade-in 0.3s ease both;
}

.rl-group-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  padding: 0 2px;
}

.rl-group-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--gray-500);
  text-transform: uppercase;
  letter-spacing: 0.6px;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 8px;
}

.rl-group-label::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--gray-300);
  flex-shrink: 0;
}

.rl-group-line {
  flex: 1;
  height: 1px;
  background: var(--gray-200);
}

.rl-record-card {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: 10px;
  padding: 16px 20px;
  margin-bottom: 8px;
  cursor: pointer;
  overflow: hidden;
  animation: rl-card-enter 0.35s ease both;
  transition: all 0.2s ease;
}

.rl-record-card:hover {
  border-color: var(--gray-300);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.06);
  transform: translateY(-1px);
}

.rl-card-accent {
  position: absolute;
  left: 0;
  top: 0;
  width: 3px;
  height: 100%;
  transition: all 0.2s ease;
}

.rl-accent-critical .rl-card-accent { background: #EF4444; }
.rl-accent-warning .rl-card-accent { background: #F59E0B; }
.rl-accent-suggestion .rl-card-accent { background: #10B981; }
.rl-accent-terminology .rl-card-accent { background: #3B82F6; }
.rl-accent-none .rl-card-accent { background: var(--gray-300); }

.rl-record-card:hover .rl-card-accent {
  width: 4px;
  box-shadow: 0 0 12px currentColor;
}

.rl-accent-critical:hover .rl-card-accent { box-shadow: 0 0 12px rgba(239, 68, 68, 0.3); }
.rl-accent-warning:hover .rl-card-accent { box-shadow: 0 0 12px rgba(245, 158, 11, 0.3); }
.rl-accent-suggestion:hover .rl-card-accent { box-shadow: 0 0 12px rgba(16, 185, 129, 0.3); }
.rl-accent-terminology:hover .rl-card-accent { box-shadow: 0 0 12px rgba(59, 130, 246, 0.3); }

@keyframes rl-card-enter {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.rl-card-left {
  flex: 1;
  min-width: 0;
  margin-left: 8px;
}

.rl-card-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--gray-900);
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rl-card-meta {
  font-size: 12px;
  color: var(--gray-400);
  margin-bottom: 8px;
}

.rl-meta-dot {
  margin: 0 6px;
  color: var(--gray-300);
}

.rl-card-severity {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.rl-sev-pill {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  padding: 1px 8px;
  height: 20px;
  border-radius: 10px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.rl-pill-critical {
  background: #FEF2F2;
  color: #DC2626;
}

.rl-pill-warning {
  background: #FFFBEB;
  color: #D97706;
}

.rl-pill-suggestion {
  background: #F0FDF4;
  color: #16A34A;
}

.rl-pill-terminology {
  background: #EFF6FF;
  color: #2563EB;
}

.rl-card-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: 16px;
}

.rl-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.rl-status-done { background: #16A34A; }
.rl-status-pending { background: #F59E0B; }
.rl-status-failed { background: #DC2626; }
.rl-status-processing { background: #2563EB; }

.rl-status-text {
  font-size: 12px;
  color: var(--gray-500);
  font-weight: 500;
}

.rl-card-arrow {
  color: var(--gray-300);
  font-size: 16px;
  transition: all 0.2s ease;
}

.rl-record-card:hover .rl-card-arrow {
  color: var(--gray-500);
  transform: translateX(3px);
}

.rl-pagination {
  display: flex;
  justify-content: center;
  padding: 8px 0 24px;
}

@keyframes rl-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
