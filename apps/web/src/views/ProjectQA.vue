<template>
  <div class="qa-page">
    <div class="qa-container">
      <ProjectList
        :projects="projects"
        :activeId="selectedProjectId"
        @select="handleSelectProject"
        @create="createProject"
        @delete="handleDeleteProject"
        @select-session="handleSelectSession"
        @create-session="handleCreateSession"
      />
      <main class="qa-main">
        <!-- 顶部标题栏 -->
        <div class="qa-header">
          <h3 class="qa-session-title">{{ currentSessionName }}</h3>
          <div class="qa-header-actions">
            <el-button size="small" @click="refreshSession">
              <el-icon><Refresh /></el-icon> 刷新会话
            </el-button>
            <el-button size="small" type="primary" @click="exportReport">
              <el-icon><Download /></el-icon> 导出报告
            </el-button>
          </div>
        </div>

        <!-- 对话式问答线程 -->
        <div class="qa-thread" ref="threadRef">
          <template v-for="msg in chatMessages" :key="msg.id">
            <!-- 用户提问气泡 -->
            <div v-if="msg.role === 'user'" class="chat-bubble-row user">
              <div class="chat-bubble user-bubble">
                {{ msg.content }}
              </div>
            </div>

            <!-- AI 回答 -->
            <div v-else class="chat-bubble-row assistant">
              <div class="ai-response">
                <!-- 流式 Markdown 正文 -->
                <MarkdownRenderer v-if="msg.content" :content="msg.content" :streaming="!!msg.loading" />

                <!-- loading 指示器 -->
                <div v-if="msg.loading" class="qa-loading">
                  <el-icon class="is-loading"><Loading /></el-icon>
                  <span>{{ msg.content ? '生成中...' : '正在分析中...' }}</span>
                </div>

                <!-- 错误提示 -->
                <div v-if="msg.error" class="qa-error">
                  <span>{{ msg.error }}</span>
                </div>

                <!-- 引用卡片（流结束后显示） -->
                <div v-if="!msg.loading && msg.chunkReferences?.length" class="ref-section">
                  <div class="ref-section-header">
                    <el-icon><Document /></el-icon>
                    <span>引用来源</span>
                  </div>
                  <div class="ref-list">
                    <div
                      v-for="(ref, idx) in msg.chunkReferences"
                      :key="idx"
                      class="ref-card"
                    >
                      <div class="ref-header">
                        <h5 class="ref-title">{{ ref.doc_name }}</h5>
                      </div>
                      <p v-if="ref.content || ref.chunk_content" class="ref-snippet">
                        "{{ ref.content || ref.chunk_content }}"
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- 底部输入栏 -->
        <div class="qa-input-bar">
          <el-input
            v-model="newQuestion"
            placeholder="请输入您的问题"
            clearable
            :disabled="isGenerating"
            @keyup.enter="addQuestion"
          >
            <template #prefix>
              <el-icon><ChatDotRound /></el-icon>
            </template>
            <template #append>
              <el-button v-if="!isGenerating" type="primary" @click="addQuestion">发送</el-button>
              <el-button v-else type="danger" @click="stopGeneration">停止</el-button>
            </template>
          </el-input>
        </div>
      </main>

      <!-- 右侧：知识库检索面板 -->
      <aside class="qa-sidebar">
        <div class="sidebar-title">
          <el-icon><Search /></el-icon>
          <span>知识库检索</span>
        </div>

        <!-- 当前查询气泡 -->
        <!-- <div v-if="currentQuery" class="query-bubble">
          {{ currentQuery }}
        </div> -->

        <!-- Tab 切换 -->
        <div class="knowledge-tabs">
          <el-tabs v-model="activeTab" @tab-change="handleTabChange">
            <el-tab-pane label="规范标准" name="standards" />
            <el-tab-pane label="期刊文献" name="journals" />
            <el-tab-pane label="我的引用" name="myRefs" />
          </el-tabs>
        </div>

        <!-- 搜索输入框 -->
        <div class="knowledge-search">
          <el-input
            v-model="knowledgeSearch"
            placeholder="搜索规范条款（如：手术室 接地）"
            @input="filterKnowledge"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>

        <!-- 知识条目列表 -->
        <div class="knowledge-list">
          <div
            v-for="item in filteredKnowledgeItems"
            :key="item.id"
            class="knowledge-item"
            :class="{ active: item.id === activeKnowledgeId }"
            @click="activeKnowledgeId = item.id"
          >
            <div class="knowledge-header">
              <h4>{{ item.title }}</h4>
            </div>
            <div class="knowledge-meta">
              <el-tag size="small" :type="item.statusType || ''">{{ item.status }}</el-tag>
              <span class="knowledge-date">{{ item.updatedAt }}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ChatDotRound, Refresh, Download, Search, Document, Loading } from '@element-plus/icons-vue'
import ProjectList from '@/components/ProjectList.vue'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import type { ProjectItem } from '@/data/mockData'
import { useQAChat } from '@/composables/useQAChat'
import {
  listChatAssistants,
  createChatAssistant,
  deleteChatAssistants,
  listChatSessions,
  createChatSession,
} from '@/service/qa'

// ===== 问答交互（对接 RAGFlow） =====

const { chatMessages, isGenerating, askQuestion, stopGeneration, clearMessages } = useQAChat()

const newQuestion = ref('')
const currentSessionId = ref<string>('')

const addQuestion = () => {
  const q = newQuestion.value.trim()
  if (!q) return
  currentQuery.value = q
  askQuestion(q, currentSessionId.value, selectedProjectId.value)
  newQuestion.value = ''
}

// ===== 会话操作 =====

const currentSessionName = ref('选择会话开始对话')

const refreshSession = () => {
  clearMessages()
  ElMessage.success('会话已刷新')
}

const exportReport = () => {
  ElMessage.info('导出报告功能待接入')
}

// ===== 自动滚动到底部 =====

const threadRef = ref<HTMLElement | null>(null)

watch(
  () => chatMessages.value[chatMessages.value.length - 1]?.content,
  async () => {
    await nextTick()
    if (threadRef.value) {
      threadRef.value.scrollTop = threadRef.value.scrollHeight
    }
  }
)

// ===== 右侧知识库面板 =====

const currentQuery = ref('')
const activeTab = ref('standards')
const knowledgeSearch = ref('')
const activeKnowledgeId = ref(1)

interface KnowledgeItem {
  id: number
  title: string
  status: string
  statusType: '' | 'success' | 'warning' | 'info' | 'danger'
  updatedAt: string
  tab: string
}

const knowledgeItems = ref<KnowledgeItem[]>([
  { id: 1, title: 'GB 50054-2011 低压配电设计规范', status: '现行有效', statusType: 'success', updatedAt: '2025-12-04更新', tab: 'standards' },
  { id: 2, title: 'JGJ 312-2013 医疗建筑电气设计规范', status: '现行有效', statusType: 'success', updatedAt: '2024-08-15更新', tab: 'standards' },
  { id: 3, title: 'GB 51309-2018 消防应急照明和疏散指示系统技术标准', status: '现行有效', statusType: 'success', updatedAt: '2025-03-22更新', tab: 'standards' },
  { id: 4, title: 'GB/T 50062-2008 电力装置的继电保护和自动装置设计规范', status: '现行有效', statusType: 'success', updatedAt: '2023-11-30更新', tab: 'standards' },
  { id: 5, title: '《建筑电气》2024-12 期刊', status: '2024年第12期', statusType: 'info', updatedAt: '手术室供电新方案', tab: 'journals' },
])

const filteredKnowledgeItems = computed(() => {
  const keyword = knowledgeSearch.value.trim().toLowerCase()
  return knowledgeItems.value.filter((it) => {
    const byTab = it.tab === activeTab.value
    const byKey = !keyword ? true : it.title.toLowerCase().includes(keyword)
    return byTab && byKey
  })
})

const filterKnowledge = () => {}
const handleTabChange = () => {
  activeKnowledgeId.value = 0
}

// ===== 左侧项目列表（对接 Chat Assistant API） =====

const projects = ref<ProjectItem[]>([])
const selectedProjectId = ref<string>('')
const projectLoading = ref(false)
const ELECTRIC_QA_PREFIX = 'elec_qa_'

// 加载项目列表
async function loadProjects() {
  projectLoading.value = true
  try {
    const list = await listChatAssistants()
    projects.value = list
      .filter((item: any) => (item.name || '').startsWith(ELECTRIC_QA_PREFIX))
      .map((item: any) => ({
        id: item.id,
        name: (item.name || '未命名对话').replace(new RegExp(`^${ELECTRIC_QA_PREFIX}`), ''),
        lastUpdated: item.update_date
          ? new Date(item.update_date).toLocaleString('zh-CN')
          : item.create_date
            ? new Date(item.create_date).toLocaleString('zh-CN')
            : '',
        isActive: false,
        sessionList: [],
      }))
    // 自动选中第一个
    if (projects.value.length > 0 && !selectedProjectId.value) {
      handleSelectProject(projects.value[0].id)
    }
  } catch (e: any) {
    ElMessage.error(e.message || '加载项目列表失败')
  } finally {
    projectLoading.value = false
  }
}

// 选中项目 → 加载 session 列表
async function handleSelectProject(projectId: string) {
  selectedProjectId.value = projectId
  projects.value.forEach(p => p.isActive = p.id === projectId)
  // 清空当前对话
  clearMessages()
  currentSessionId.value = ''
  currentSessionName.value = '选择会话开始对话'
  // 加载该项目的 session 列表
  await loadSessions(projectId)
}

// 加载 session 列表
async function loadSessions(projectId: string) {
  try {
    const sessions = await listChatSessions(projectId)
    const project = projects.value.find(p => p.id === projectId)
    if (project) {
      project.sessionList = sessions.map((s: any) => ({
        id: s.id,
        name: s.name || '未命名会话',
      }))
    }
  } catch (e: any) {
    ElMessage.error(e.message || '加载会话列表失败')
  }
}

// 选中 session → 切换 sessionId
function handleSelectSession(_projectId: string, session: any) {
  currentSessionId.value = session.id
  currentSessionName.value = session.name || '未命名会话'
  clearMessages()
}

// 新建项目
async function createProject() {
  try {
    const { value: name } = await ElMessageBox.prompt('请输入对话名称', '新建对话', {
      confirmButtonText: '创建',
      cancelButtonText: '取消',
      inputPattern: /\S+/,
      inputErrorMessage: '名称不能为空',
    })
    if (!name) return
    await createChatAssistant(`${ELECTRIC_QA_PREFIX}${name}`)
    ElMessage.success('创建成功')
    await loadProjects()
  } catch {
    // 用户取消
  }
}

// 删除项目
async function handleDeleteProject(projectId: string) {
  const project = projects.value.find(p => p.id === projectId)
  try {
    await ElMessageBox.confirm(
      `确定删除「${project?.name || '该对话'}」？删除后不可恢复。`,
      '删除对话',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    )
    await deleteChatAssistants([projectId])
    ElMessage.success('删除成功')
    if (selectedProjectId.value === projectId) {
      selectedProjectId.value = ''
      currentSessionId.value = ''
      currentSessionName.value = '选择会话开始对话'
      clearMessages()
    }
    await loadProjects()
  } catch {
    // 用户取消
  }
}

// 新建 session
async function handleCreateSession(projectId: string) {
  try {
    const result = await createChatSession(projectId)
    ElMessage.success('会话创建成功')
    await loadSessions(projectId)
    // 自动切换到新 session
    if (result?.id) {
      currentSessionId.value = result.id
      currentSessionName.value = result.name || '新会话'
      clearMessages()
    }
  } catch (e: any) {
    ElMessage.error(e.message || '创建会话失败')
  }
}

// 页面加载时获取项目列表
onMounted(() => {
  loadProjects()
})
</script>

<style scoped>
.qa-page {
  height: 100%;
  background: var(--gray-50);
  display: flex;
  flex-direction: column;
}

.qa-container {
  display: grid;
  grid-template-columns: 280px 1fr 300px;
  gap: 16px;
  padding: 16px;
  height: 100%;
  min-height: 0;
}

/* ===== 中栏主体 ===== */

.qa-main {
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.qa-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--gray-200);
  flex-shrink: 0;
}

.qa-session-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0;
}

.qa-header-actions {
  display: flex;
  gap: 8px;
}

.qa-thread {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

/* 对话气泡行 */
.chat-bubble-row {
  display: flex;
  width: 100%;
}

.chat-bubble-row.user {
  justify-content: flex-end;
}

.chat-bubble-row.assistant {
  justify-content: flex-start;
}

/* 用户气泡 */
.chat-bubble.user-bubble {
  max-width: 70%;
  padding: 10px 14px;
  background: var(--el-color-primary);
  color: #fff;
  border-radius: 12px 12px 2px 12px;
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
}

/* AI 回答区块 */
.ai-response {
  width: 100%;
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-md);
  padding: 16px;
}

.qa-message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.qa-source {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--gray-600);
}

.qa-source-text {
  font-weight: 500;
}

.qa-time {
  font-size: 12px;
  color: var(--gray-500);
}

/* 结论区块 */
.qa-conclusion {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  background: #f0fdf4;
  border-radius: var(--radius-md);
  margin-bottom: 12px;
}

.qa-conclusion-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  flex-shrink: 0;
  margin-top: 5px;
}

.qa-conclusion-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--gray-900);
  line-height: 1.6;
}

/* 推理过程 */
.qa-section {
  margin-top: 12px;
}

.qa-section-header {
  cursor: pointer;
  user-select: none;
}

.qa-section-header h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--gray-900);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.expand-icon {
  transition: transform 0.2s;
  font-size: 12px;
  margin-left: 4px;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

.qa-reasoning-list {
  padding-left: 8px;
}

.qa-reasoning-step {
  font-size: 13px;
  color: var(--gray-700);
  line-height: 1.8;
  margin-bottom: 4px;
}

.step-order {
  font-weight: 600;
  color: var(--gray-900);
  margin-right: 4px;
}

.step-norm-ref {
  color: var(--el-color-primary);
  font-size: 12px;
}

/* 规范依据卡片 */
.ref-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ref-card {
  background: white;
  border: 1px solid var(--gray-200);
  border-left: 3px solid var(--el-color-primary);
  border-radius: var(--radius-md);
  padding: 12px;
  position: relative;
}

.ref-card.mandatory {
  border-left-color: var(--el-color-danger);
}

.ref-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.ref-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-color-primary);
  margin: 0;
}

.ref-snippet {
  font-size: 13px;
  color: var(--gray-700);
  line-height: 1.6;
  margin-bottom: 8px;
  font-style: italic;
}

.ref-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--gray-600);
}

.ref-actions {
  display: flex;
  gap: 4px;
}

.ref-mandatory-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--el-color-danger);
  font-size: 12px;
  font-weight: 500;
  margin-top: 8px;
}

/* loading 和 error 状态 */
.qa-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0 4px;
  color: var(--gray-500);
  font-size: 13px;
}

.qa-error {
  padding: 8px 12px;
  margin-top: 8px;
  background: var(--el-color-danger-light-9);
  border-radius: var(--radius-md);
  color: var(--el-color-danger);
  font-size: 13px;
}

/* 引用来源区块 */
.ref-section {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--gray-200);
}

.ref-section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--gray-700);
  margin-bottom: 8px;
}

/* 底部输入栏 */
.qa-input-bar {
  padding: 12px 16px;
  border-top: 1px solid var(--gray-200);
  flex-shrink: 0;
}

.qa-input-bar :deep(.el-input-group__append) {
  padding: 0;
  width: 60px;
}

/* ===== 右侧知识库面板 ===== */

.qa-sidebar {
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.sidebar-title {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 14px 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--gray-900);
  border-bottom: 1px solid var(--gray-200);
  flex-shrink: 0;
}

.query-bubble {
  margin: 12px 12px 0;
  padding: 10px 12px;
  background: var(--el-color-primary-light-9);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--el-color-primary);
  line-height: 1.5;
  flex-shrink: 0;
}

.knowledge-tabs {
  padding: 0 12px;
  flex-shrink: 0;
}

.knowledge-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
}

.knowledge-search {
  padding: 10px 12px;
  flex-shrink: 0;
}

.knowledge-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 12px;
}

.knowledge-item {
  padding: 10px 12px;
  border-left: 3px solid transparent;
  border-bottom: 1px solid var(--gray-100);
  cursor: pointer;
  transition: all 0.15s;
}

.knowledge-item:hover {
  background: var(--gray-50);
}

.knowledge-item.active {
  border-left-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.knowledge-header h4 {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-color-primary);
  margin-bottom: 6px;
  line-height: 1.4;
}

.knowledge-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.knowledge-date {
  font-size: 11px;
  color: var(--gray-500);
}
</style>
