<template>
  <div class="clauses-page">
    <!-- 头部 -->
    <div class="section-header">
      <h2>规范条文管理</h2>
      <p class="section-desc">管理规范标准、条文和检查点，用于文档审查时的语义匹配与合规比对</p>
    </div>

    <div class="clauses-body">
      <!-- ===== 左栏：规范标准列表 ===== -->
      <aside class="clauses-sidebar">
        <div class="sidebar-header">
          <span class="sidebar-title">规范标准</span>
          <el-button size="small" :icon="Plus" circle @click="openStandardDialog()" title="新增标准" />
        </div>
        <div class="sidebar-search">
          <el-input
            v-model="standardSearch"
            placeholder="搜索标准..."
            :prefix-icon="Search"
            size="small"
            clearable
            @input="onSearchStandard"
          />
        </div>
        <div class="sidebar-list">
          <div
            v-for="group in groupedStandards"
            :key="group.profession"
            class="sidebar-group"
          >
            <div class="sidebar-group-label">{{ group.profession }}</div>
            <div
              v-for="std in group.standards"
              :key="std.id"
              class="sidebar-item"
              :class="{ active: selectedStandardId === std.id }"
              @click="selectStandard(std.id)"
            >
              <div class="sidebar-item-top">
                <span class="sidebar-item-number">{{ std.number }}</span>
                <el-tag
                  v-if="std.status === 'superseded'"
                  size="small"
                  type="info"
                  class="sidebar-item-status"
                >废止</el-tag>
              </div>
              <div class="sidebar-item-name">{{ std.name }}</div>
            </div>
          </div>
          <div v-if="groupedStandards.length === 0" class="sidebar-empty">
            暂无规范标准
          </div>
        </div>
      </aside>

      <!-- ===== 右栏：条文详情 ===== -->
      <main class="clauses-main">
        <template v-if="selectedStandard">
          <!-- 标准头部 -->
          <div class="main-header">
            <div class="main-header-left">
              <h3 class="main-standard-number">{{ selectedStandard.number }}</h3>
              <span class="main-standard-name">{{ selectedStandard.name }}</span>
              <el-tag size="small" :type="selectedStandard.status === 'active' ? 'success' : 'info'">
                {{ selectedStandard.status === 'active' ? '现行' : '废止' }}
              </el-tag>
            </div>
            <div class="main-header-actions">
              <el-button size="small" text @click="openStandardDialog(selectedStandard)">编辑</el-button>
              <el-button size="small" text type="danger" @click="handleDeleteStandard">删除</el-button>
            </div>
          </div>
          <div v-if="selectedStandard.description" class="main-desc">
            {{ selectedStandard.description }}
          </div>
          <div v-if="selectedStandard.status === 'superseded' && selectedStandard.supersededBy" class="main-desc superseded-desc">
            被取代：{{ selectedStandard.supersededBy }}
          </div>

          <!-- 条文操作栏 -->
          <div class="main-actions">
            <el-button size="small" :icon="Plus" @click="openClauseDialog()">新增条文</el-button>
          </div>

          <!-- 条文列表 -->
          <div v-if="standardClauses.length === 0" class="main-empty">
            该标准下暂无条文
          </div>
          <div v-else class="clause-list">
            <template v-for="ct in standardClauses" :key="ct.clause.id">
              <div class="clause-card" :id="'clause-' + ct.clause.id">
                <div class="clause-card-header" @click="ct.expanded = !ct.expanded">
                    <div class="clause-card-left">
                      <span class="clause-num">{{ ct.clause.clauseNumber }}</span>
                      <span class="clause-title">{{ ct.clause.title }}</span>
                    </div>
                    <div class="clause-card-actions">
                      <el-button size="small" text @click.stop="openClauseDialog(ct.clause)">编辑</el-button>
                      <el-button size="small" text type="danger" @click.stop="handleDeleteClause(ct.clause)">删除</el-button>
                      <el-icon :size="14" class="expand-icon" :class="{ expanded: ct.expanded }">
                        <ArrowRight />
                      </el-icon>
                    </div>
                  </div>

                  <!-- 条文原文 -->
                  <div class="clause-content" :class="{ expanded: ct.expanded }">
                    <div class="clause-content-text">{{ ct.clause.content }}</div>

                    <!-- 关键词标签 -->
                    <div v-if="ct.clause.tags.length" class="clause-tags">
                      <el-tag v-for="tag in ct.clause.tags" :key="tag" size="small" class="clause-tag-item">{{ tag }}</el-tag>
                    </div>

                    <!-- 检查点 -->
                    <div class="checkpoint-section">
                      <div class="checkpoint-header">
                        <span class="checkpoint-label">检查点</span>
                        <el-button size="small" text :icon="Plus" @click="openCheckpointDialog(ct.clause.id)">新增</el-button>
                      </div>
                      <div v-if="ct.checkpoints.length === 0" class="checkpoint-empty">暂无检查点</div>
                      <div v-for="cp in ct.checkpoints" :key="cp.id" class="checkpoint-item">
                        <div class="checkpoint-item-left">
                          <el-tag size="small" :type="severityTagType(cp.severity)" class="cp-severity">
                            {{ severityLabel(cp.severity) }}
                          </el-tag>
                          <span class="cp-desc">{{ cp.description }}</span>
                        </div>
                        <div class="checkpoint-item-actions">
                          <el-button size="small" text @click="openCheckpointDialog(ct.clause.id, cp)">编辑</el-button>
                          <el-button size="small" text type="danger" @click="handleDeleteCheckpoint(cp)">删除</el-button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </div>
        </template>

        <!-- 未选中标准 -->
        <div v-else class="main-placeholder">
          <el-empty description="请从左侧选择一个规范标准" :image-size="120" />
        </div>
      </main>
    </div>

    <!-- ===== 标准弹窗 ===== -->
    <el-dialog v-model="stdDialogVisible" :title="stdEditingId ? '编辑标准' : '新增标准'" width="540px" :close-on-click-modal="false" destroy-on-close>
      <el-form ref="stdFormRef" :model="stdForm" :rules="stdFormRules" label-position="top" size="small">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="规范编号" prop="number">
              <el-input v-model="stdForm.number" placeholder="如 GB 50052-2009" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="规范名称" prop="name">
              <el-input v-model="stdForm.name" placeholder="如 供配电系统设计规范" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="专业" prop="profession">
              <el-select v-model="stdForm.profession" placeholder="选择专业" style="width:100%">
                <el-option v-for="p in PROFESSION_OPTIONS" :key="p.value" :label="p.label" :value="p.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态" prop="status">
              <el-select v-model="stdForm.status" placeholder="选择状态" style="width:100%">
                <el-option label="现行" value="active" />
                <el-option label="废止" value="superseded" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item v-if="stdForm.status === 'superseded'" label="被取代依据">
          <el-input v-model="stdForm.supersededBy" placeholder="说明被哪个规范/条文取代" />
        </el-form-item>
        <el-form-item label="规范简介">
          <el-input v-model="stdForm.description" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="stdDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSaveStandard">{{ stdEditingId ? '保存' : '新增' }}</el-button>
      </template>
    </el-dialog>

    <!-- ===== 条文弹窗 ===== -->
    <el-dialog v-model="clauseDialogVisible" :title="clauseEditingId ? '编辑条文' : '新增条文'" width="640px" :close-on-click-modal="false" destroy-on-close>
      <el-form ref="clauseFormRef" :model="clauseForm" :rules="clauseFormRules" label-position="top" size="small">
        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="条款号" prop="clauseNumber">
              <el-input v-model="clauseForm.clauseNumber" placeholder="如 3.0.2" />
            </el-form-item>
          </el-col>
          <el-col :span="16">
            <el-form-item label="条款标题" prop="title">
              <el-input v-model="clauseForm.title" placeholder="如 一级负荷供电要求" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="条文原文" prop="content">
          <el-input v-model="clauseForm.content" type="textarea" :rows="5" placeholder="请输入条文原文内容" />
        </el-form-item>
        <el-form-item label="关键词标签">
          <el-select v-model="clauseForm.tags" multiple filterable allow-create default-first-option placeholder="输入关键词后回车" style="width:100%">
            <el-option v-for="tag in tagSuggestions" :key="tag" :label="tag" :value="tag" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="clauseDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSaveClause">{{ clauseEditingId ? '保存' : '新增' }}</el-button>
      </template>
    </el-dialog>

    <!-- ===== 检查点弹窗 ===== -->
    <el-dialog v-model="cpDialogVisible" :title="cpEditingId ? '编辑检查点' : '新增检查点'" width="540px" :close-on-click-modal="false" destroy-on-close>
      <el-form ref="cpFormRef" :model="cpForm" :rules="cpFormRules" label-position="top" size="small">
        <el-form-item label="检查描述" prop="description">
          <el-input v-model="cpForm.description" type="textarea" :rows="3" placeholder="如：应明确采用双电源供电" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="严重级别" prop="severity">
              <el-select v-model="cpForm.severity" style="width:100%">
                <el-option label="严重" value="critical" />
                <el-option label="警告" value="warning" />
                <el-option label="建议" value="suggestion" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="匹配关键词">
              <el-select v-model="cpForm.matchKeywords" multiple filterable allow-create default-first-option placeholder="输入后回车" style="width:100%">
                <el-option v-for="kw in keywordSuggestions" :key="kw" :label="kw" :value="kw" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="cpDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSaveCheckpoint">{{ cpEditingId ? '保存' : '新增' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, ArrowRight } from '@element-plus/icons-vue'
import type { FormInstance } from 'element-plus'
import {
  getStandardTreeApi as getStandardTree,
  createStandardApi as createStandard,
  updateStandardApi as updateStandard,
  deleteStandardApi as deleteStandard,
  getClausesByStandardApi as getClausesByStandard,
  createClauseApi as createClause,
  updateClauseApi as updateClause,
  deleteClauseApi as deleteClause,
  createCheckpointApi as createCheckpoint,
  updateCheckpointApi as updateCheckpoint,
  deleteCheckpointApi as deleteCheckpoint,
  PROFESSION_OPTIONS,
  type Standard,
  type Clause,
  type Checkpoint,
  type StandardTreeNode,
  type ClauseTreeNode,
} from '../service/standardClauses'

const route = useRoute()

// ===== 左栏：标准列表 =====

const standardSearch = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null
const treeData = ref<StandardTreeNode[]>([])

const filteredTree = computed(() => {
  if (!standardSearch.value) return treeData.value
  const kw = standardSearch.value.toLowerCase()
  return treeData.value.filter(n =>
    n.standard.number.toLowerCase().includes(kw) ||
    n.standard.name.toLowerCase().includes(kw)
  )
})

const groupedStandards = computed(() => {
  const map: Record<string, typeof filteredTree.value> = {}
  for (const node of filteredTree.value) {
    const p = node.standard.profession || '其他'
    if (!map[p]) map[p] = []
    map[p].push(node)
  }
  const order = PROFESSION_OPTIONS.map(o => o.value)
  return Object.entries(map)
    .sort(([a], [b]) => {
      const ia = order.indexOf(a), ib = order.indexOf(b)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
    .map(([profession, nodes]) => ({ profession, standards: nodes.map(n => n.standard) }))
})

const selectedStandardId = ref<string | null>(null)

const selectedStandard = computed(() => {
  if (!selectedStandardId.value) return null
  const node = treeData.value.find(n => n.standard.id === selectedStandardId.value)
  return node?.standard || null
})

function onSearchStandard() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {}, 300)
}

function selectStandard(id: string) {
  selectedStandardId.value = id
  loadClausesForStandard()
}

// ===== 右栏：条文列表 =====

const standardClauses = ref<ClauseTreeNode[]>([])

async function loadClausesForStandard() {
  if (!selectedStandardId.value) return
  standardClauses.value = await getClausesByStandard(selectedStandardId.value)
}

// ===== 增删改查：Standard =====

const stdDialogVisible = ref(false)
const stdEditingId = ref('')
const stdFormRef = ref<FormInstance | null>(null)
const stdForm = ref({ number: '', name: '', profession: '', status: 'active' as 'active' | 'superseded', supersededBy: '', description: '' })
const stdFormRules = { number: [{ required: true, message: '请输入规范编号', trigger: 'blur' }], name: [{ required: true, message: '请输入规范名称', trigger: 'blur' }], profession: [{ required: true, message: '请选择专业', trigger: 'change' }] }

function openStandardDialog(standard?: Standard) {
  stdEditingId.value = standard?.id || ''
  stdForm.value = {
    number: standard?.number || '',
    name: standard?.name || '',
    profession: standard?.profession || '',
    status: standard?.status || 'active',
    supersededBy: standard?.supersededBy || '',
    description: standard?.description || '',
  }
  stdDialogVisible.value = true
}

async function handleSaveStandard() {
  const valid = await stdFormRef.value?.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    if (stdEditingId.value) {
      await updateStandard(stdEditingId.value, stdForm.value)
      ElMessage.success('标准已更新')
    } else {
      await createStandard(stdForm.value)
      ElMessage.success('标准已新增')
    }
    stdDialogVisible.value = false
    await reloadTree()
  } finally { saving.value = false }
}

async function handleDeleteStandard() {
  if (!selectedStandardId.value) return
  try {
    await ElMessageBox.confirm('确定要删除该标准及其所有条文和检查点吗？此操作不可恢复。', '确认删除', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' })
    const ok = await deleteStandard(selectedStandardId.value)
    if (ok) {
      ElMessage.success('已删除')
      selectedStandardId.value = null
      standardClauses.value = []
      await reloadTree()
    }
  } catch { /* cancel */ }
}

// ===== 增删改查：Clause =====

const clauseDialogVisible = ref(false)
const clauseEditingId = ref('')
const clauseFormRef = ref<FormInstance | null>(null)
const clauseForm = ref({ clauseNumber: '', title: '', content: '', tags: [] as string[] })
const clauseFormRules = { clauseNumber: [{ required: true, message: '请输入条款号', trigger: 'blur' }], content: [{ required: true, message: '请输入条文原文', trigger: 'blur' }] }

function openClauseDialog(clause?: Clause) {
  clauseEditingId.value = clause?.id || ''
  clauseForm.value = {
    clauseNumber: clause?.clauseNumber || '',
    title: clause?.title || '',
    content: clause?.content || '',
    tags: clause?.tags ? [...clause.tags] : [],
  }
  clauseDialogVisible.value = true
}

async function handleSaveClause() {
  const valid = await clauseFormRef.value?.validate().catch(() => false)
  if (!valid) return
  if (!selectedStandardId.value) return
  saving.value = true
  try {
    if (clauseEditingId.value) {
      await updateClause(clauseEditingId.value, clauseForm.value)
      ElMessage.success('条文已更新')
    } else {
      await createClause({ standardId: selectedStandardId.value, ...clauseForm.value })
      ElMessage.success('条文已新增')
    }
    clauseDialogVisible.value = false
    await loadClausesForStandard()
  } finally { saving.value = false }
}

async function handleDeleteClause(clause: Clause) {
  try {
    await ElMessageBox.confirm(`确定要删除"${clause.clauseNumber || clause.title}"及其检查点吗？`, '确认删除', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' })
    const ok = await deleteClause(clause.id)
    if (ok) {
      ElMessage.success('已删除')
      await loadClausesForStandard()
    }
  } catch { /* cancel */ }
}

// ===== 增删改查：Checkpoint =====

const cpDialogVisible = ref(false)
const cpEditingId = ref('')
const cpFormRef = ref<FormInstance | null>(null)
const cpForm = ref({ description: '', severity: 'warning' as Checkpoint['severity'], matchKeywords: [] as string[] })
const cpFormRules = { description: [{ required: true, message: '请输入检查描述', trigger: 'blur' }], severity: [{ required: true, message: '请选择严重级别', trigger: 'change' }] }
const currentCpClauseId = ref('')

function openCheckpointDialog(clauseId: string, cp?: Checkpoint) {
  currentCpClauseId.value = clauseId
  cpEditingId.value = cp?.id || ''
  cpForm.value = {
    description: cp?.description || '',
    severity: cp?.severity || 'warning',
    matchKeywords: cp?.matchKeywords ? [...cp.matchKeywords] : [],
  }
  cpDialogVisible.value = true
}

async function handleSaveCheckpoint() {
  const valid = await cpFormRef.value?.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    if (cpEditingId.value) {
      await updateCheckpoint(cpEditingId.value, cpForm.value)
      ElMessage.success('检查点已更新')
    } else {
      await createCheckpoint({ clauseId: currentCpClauseId.value, ...cpForm.value })
      ElMessage.success('检查点已新增')
    }
    cpDialogVisible.value = false
    await loadClausesForStandard()
  } finally { saving.value = false }
}

async function handleDeleteCheckpoint(cp: Checkpoint) {
  try {
    await ElMessageBox.confirm('确定要删除该检查点吗？', '确认删除', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' })
    const ok = await deleteCheckpoint(cp.id)
    if (ok) {
      ElMessage.success('已删除')
      await loadClausesForStandard()
    }
  } catch { /* cancel */ }
}

// ===== 工具函数 =====

const saving = ref(false)

const tagSuggestions = [
  '一级负荷', '二级负荷', '供电电源', '双电源', '双回路',
  '防雷', '防雷分类', '接地', '电气安全',
  '配电线路', '电缆桥架', '敷设',
  '火灾报警', '集中报警',
  '照明功率', '节能',
  '给水系统', '排水系统', '重力流',
  '通风', '空调系统', '负荷',
  '建筑分类', '防火', '抗震',
  '废止', '替代',
]

const keywordSuggestions = ['双电源', '双回路', '消防', '应急照明', '疏散', '负荷等级', '供电', '防雷', '接地', '电缆']

function severityTagType(severity: string): '' | 'success' | 'warning' | 'info' | 'danger' {
  return { critical: 'danger', warning: 'warning', suggestion: 'success' }[severity] as any || 'info'
}

function severityLabel(severity: string): string {
  return { critical: '严重', warning: '警告', suggestion: '建议' }[severity] || severity
}

async function reloadTree() {
  treeData.value = await getStandardTree()
  if (selectedStandardId.value) {
    const stillExists = treeData.value.some(n => n.standard.id === selectedStandardId.value)
    if (!stillExists) {
      selectedStandardId.value = null
      standardClauses.value = []
    } else {
      await loadClausesForStandard()
    }
  }
}

function scrollToClause(clauseId: string) {
  nextTick(() => {
    const el = document.getElementById(`clause-${clauseId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('clause-highlight')
      setTimeout(() => el.classList.remove('clause-highlight'), 2000)
    }
  })
}

onMounted(async () => {
  treeData.value = await getStandardTree()

  if (route.query.standardId) {
    selectedStandardId.value = route.query.standardId as string
    await loadClausesForStandard()
    if (route.query.clauseId) {
      await nextTick()
      scrollToClause(route.query.clauseId as string)
    }
  }
})
</script>

<style scoped>
/* ===== 整体布局 ===== */
.clauses-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--gray-50);
  padding: 20px 24px;
}

.section-header {
  margin-bottom: 16px;
  flex-shrink: 0;
}
.section-header h2 {
  font-size: 22px;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0 0 6px;
}
.section-desc {
  font-size: 13px;
  color: var(--gray-500);
  margin: 0;
}

/* ===== 左右布局 ===== */
.clauses-body {
  flex: 1;
  display: flex;
  gap: 16px;
  overflow: hidden;
  min-height: 0;
}

/* ===== 左栏 ===== */
.clauses-sidebar {
  width: 280px;
  min-width: 280px;
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 8px;
}
.sidebar-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--gray-800);
}

.sidebar-search {
  padding: 8px 12px;
}

.sidebar-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 8px;
}

.sidebar-group {
  margin-bottom: 4px;
}
.sidebar-group-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--gray-400);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 8px 8px 4px;
}

.sidebar-item {
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.12s ease;
  margin-bottom: 2px;
}
.sidebar-item:hover {
  background: var(--gray-50);
}
.sidebar-item.active {
  background: var(--primary-light, #E6F2FF);
}
.sidebar-item-top {
  display: flex;
  align-items: center;
  gap: 6px;
}
.sidebar-item-number {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary-color);
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
}
.sidebar-item-status {
  margin-left: auto;
}
.sidebar-item-name {
  font-size: 12px;
  color: var(--gray-600);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sidebar-empty {
  text-align: center;
  padding: 40px 0;
  color: var(--gray-400);
  font-size: 13px;
}

/* ===== 右栏 ===== */
.clauses-main {
  flex: 1;
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.main-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 8px;
  flex-shrink: 0;
}
.main-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.main-standard-number {
  font-size: 17px;
  font-weight: 700;
  color: var(--primary-color);
  margin: 0;
  white-space: nowrap;
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
}
.main-standard-name {
  font-size: 15px;
  color: var(--gray-700);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.main-header-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.main-desc {
  font-size: 13px;
  color: var(--gray-500);
  padding: 0 20px 6px;
}
.superseded-desc {
  color: var(--gray-400);
  font-style: italic;
}

.main-actions {
  padding: 8px 20px 4px;
  border-bottom: 1px solid var(--gray-100);
  flex-shrink: 0;
}

.main-placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.main-empty {
  text-align: center;
  padding: 60px 0;
  color: var(--gray-400);
  font-size: 13px;
}

/* ===== 条文列表 ===== */
.clause-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 16px 16px;
}

.chapter-group {
  margin-bottom: 8px;
}
.chapter-title {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--gray-700);
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.12s;
  user-select: none;
}
.chapter-title:hover {
  background: var(--gray-50);
}
.chapter-arrow {
  transition: transform 0.15s ease;
  color: var(--gray-400);
}
.chapter-arrow.expanded {
  transform: rotate(90deg);
}
.chapter-count {
  font-weight: 400;
  font-size: 11px;
  color: var(--gray-400);
  margin-left: auto;
}

/* 条文卡片 */
.clause-card {
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  margin-bottom: 6px;
  overflow: hidden;
  transition: box-shadow 0.15s;
}
.clause-card:hover {
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
}

.clause-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.12s;
}
.clause-card-header:hover {
  background: var(--gray-50);
}
.clause-card-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.clause-num {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  background: var(--gray-100);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--gray-700);
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  white-space: nowrap;
}
.clause-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--gray-800);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.clause-card-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}
.expand-icon {
  color: var(--gray-400);
  transition: transform 0.15s ease;
  margin-left: 4px;
}
.expand-icon.expanded {
  transform: rotate(90deg);
}

.clause-content {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.2s ease, padding 0.2s ease;
}
.clause-content.expanded {
  max-height: 2000px;
  padding: 0 12px 12px;
}

.clause-content-text {
  font-size: 13px;
  line-height: 1.7;
  color: var(--gray-600);
  padding: 10px 12px;
  background: var(--gray-50);
  border-radius: 6px;
  margin-bottom: 10px;
}

.clause-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 12px;
}
.clause-tag-item {
  margin: 0;
}

/* 检查点 */
.checkpoint-section {
  border-top: 1px solid var(--gray-100);
  padding-top: 10px;
}
.checkpoint-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.checkpoint-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--gray-500);
}
.checkpoint-empty {
  font-size: 12px;
  color: var(--gray-400);
  padding: 6px 0;
}

.checkpoint-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 6px;
  transition: background 0.12s;
  gap: 8px;
}
.checkpoint-item:hover {
  background: var(--gray-50);
}
.checkpoint-item-left {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.cp-severity {
  flex-shrink: 0;
  margin-top: 1px;
}
.cp-desc {
  font-size: 13px;
  color: var(--gray-700);
  line-height: 1.5;
}
.checkpoint-item-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.12s;
}
.checkpoint-item:hover .checkpoint-item-actions {
  opacity: 1;
}

/* 定位高亮 */
.clause-highlight {
  animation: clause-flash 2s ease-out;
}
@keyframes clause-flash {
  0% { box-shadow: 0 0 0 3px var(--primary-color); background: var(--primary-light); }
  100% { box-shadow: 0 0 0 0 transparent; background: transparent; }
}
</style>
