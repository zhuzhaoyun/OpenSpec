<script setup lang="ts">
import { ref, onMounted, computed, type Component } from 'vue'
import { useRouter } from 'vue-router'
import { ElNotification, ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus,
  Setting,
  HomeFilled,
  Document,
  EditPen,
  Files,
  ChatLineRound,
  Reading,
  DataAnalysis,
  QuestionFilled,
  MagicStick,
  Edit,
  ChatLineSquare,
  MoreFilled,
  Search,
  Fold,
  Grid,
  List,
  User,
  Key,
  Bell,
  Coin
} from '@element-plus/icons-vue'
import LoginDialog from '../components/LoginDialog.vue'
import ProfileDialog from '../components/ProfileDialog.vue'
import LicenseInfoDialog from '../components/LicenseInfoDialog.vue'
import UserDropdown from '../components/UserDropdown.vue'
import HeaderLogo from '../components/HeaderLogo.vue'
import HelpCenter from '../components/HelpCenter.vue'
import DocumentCardList from '../components/DocumentCardList.vue'
import Settings from '../views/Settings.vue'
import MemoryManagement from '../views/MemoryManagement.vue'
import ProjectQA from '../views/ProjectQA.vue'
import StandardClauses from '../views/StandardClauses.vue'
import ReviewList from '../views/ReviewList.vue'
import { type DocumentItem, type ProjectInfo } from '../data/mockData'
import {
  renameDocument as renameDocumentApi,
  deleteDocument as deleteDocumentApi,
  getDocumentList,
  exportDocumentMarkdown
} from '../service/document'
import { importToAutoCAD } from '../service/localCad'
import { downloadFile } from '../utils/document'
import { useAuthGuard } from '../composables/useAuthGuard'
import { authStorage } from '../utils/auth'
import { hasTemplateManagementLicense, hasMemoryManagementLicense } from '../service/license'
import { getAllTags, type TemplateTag } from '../service/template'

const router = useRouter()

// ========== 懒认证 ==========
const {
  showLoginDialog,
  isAuthenticated,
  requireAuth,
  onLoginSuccess: handleLoginSuccessBase,
  onLoginCancel
} = useAuthGuard()

// ========== 用户信息 ==========
const userInfoVersion = ref(0)
const userInfo = computed(() => {
  void userInfoVersion.value
  return authStorage.getUserInfo()
})
const userId = computed(() => {
  const info = userInfo.value
  return info?.id || ''
})
const userDisplayName = computed(() =>
  userInfo.value?.nickname || userInfo.value?.name || '用户'
)

function refreshUserInfo() {
  userInfoVersion.value++
}

const greetingTime = computed(() => {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了'
  if (hour < 12) return '上午好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

// ========== 侧边栏 ==========
interface MenuItem {
  key: string
  label: string
  icon: Component
  requiresAuth: boolean
  action: 'view' | 'route'
  route?: string
  comingSoon?: boolean
}

interface MenuGroup {
  label: string
  items: MenuItem[]
}

const activeView = ref('dashboard')

const menuGroups: MenuGroup[] = [
  {
    label: '核心功能',
    items: [
      { key: 'dashboard', label: '首页', icon: HomeFilled, requiresAuth: false, action: 'view' },
      { key: 'documents', label: '我的文档', icon: Document, requiresAuth: true, action: 'view' },
      { key: 'create', label: '新建文档', icon: EditPen, requiresAuth: true, action: 'route', route: '/create' },
    ]
  },
  {
    label: '工具',
    items: [
      { key: 'templates', label: '模板管理', icon: Files, requiresAuth: true, action: 'view' },
      { key: 'review', label: '规范审查', icon: Edit, requiresAuth: true, action: 'view' },
      { key: 'clauses', label: '规范条文', icon: Reading, requiresAuth: true, action: 'view' },
      { key: 'memory', label: '记忆管理', icon: Coin, requiresAuth: true, action: 'view' },
    ]
  },
  {
    label: '更多',
    items: [
      { key: 'qa', label: '规范问答', icon: ChatLineRound, requiresAuth: false, action: 'view', comingSoon: true },
      { key: 'statistics', label: '数据统计', icon: DataAnalysis, requiresAuth: false, action: 'view', comingSoon: true },
      { key: 'help', label: '帮助中心', icon: QuestionFilled, requiresAuth: false, action: 'view' },
    ]
  },
]

const activeViewItem = computed(() => {
  for (const group of menuGroups) {
    const found = group.items.find(i => i.key === activeView.value)
    if (found) return found
  }
  return null
})

function findMenuItem(key: string): MenuItem {
  for (const group of menuGroups) {
    const found = group.items.find(i => i.key === key)
    if (found) return found
  }
  return menuGroups[0].items[0]
}

const handleMenuClick = (item: MenuItem) => {
  if (item.comingSoon) {
    activeView.value = item.key
    return
  }

  if (item.action === 'route') {
    if (item.requiresAuth) {
      requireAuth(() => router.push(item.route!))
    } else {
      router.push(item.route!)
    }
    return
  }

  // action === 'view'
  if (item.key === 'templates') {
    requireAuth(async () => {
      const hasLicense = await hasTemplateManagementLicense()
      if (hasLicense) {
        activeView.value = 'templates'
      } else {
        ElMessageBox.alert(
          '模板管理功能需要企业版授权，请联系我们升级到企业版。',
          '升级到企业版',
          { confirmButtonText: '我知道了', type: 'warning' }
        )
      }
    })
  } else if (item.requiresAuth) {
    requireAuth(() => {
      activeView.value = item.key
      if (item.key === 'documents') {
        loadDocumentList()
      }
    })
  } else {
    activeView.value = item.key
  }
}

// ========== 登录成功回调 ==========
function onLoginSuccess() {
  handleLoginSuccessBase()
  if (activeView.value === 'documents') {
    loadDocumentList()
  } else if (isAuthenticated()) {
    loadDocumentList()
  }
}

// ========== 用户下拉菜单 ==========
const showProfileDialog = ref(false)
const showLicenseDialog = ref(false)

// 处理用户下拉菜单命令（logout 由 UserDropdown 统一处理）
const handleUserCommand = async (command: string) => {
  switch (command) {
    case 'profile':
      showProfileDialog.value = true
      break
    case 'documents':
      activeView.value = 'documents'
      break
    case 'license':
      showLicenseDialog.value = true
      break
    case 'settings':
      handleMenuClick(findMenuItem('templates'))
      break
    case 'help':
      activeView.value = 'help'
      break;
    case 'logout':
      activeView.value = 'dashboard'
      documents.value = []
      break
  }
}

// ========== Settings 组件导航 ==========
const handleSettingsNavigate = (path: string) => {
  router.push(path)
}

// ========== 文档数据 ==========
const documents = ref<DocumentItem[]>([])
const loadingDocuments = ref(false)
const recentDocsViewMode = ref<'grid' | 'list'>('grid')
const docsViewMode = ref<'grid' | 'list'>('grid')

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

const sortDocumentsByDate = () => {
  documents.value.sort((a, b) => {
    const dateA = new Date(a.lastModified)
    const dateB = new Date(b.lastModified)
    return dateB.getTime() - dateA.getTime()
  })
}

// 最近文档（仪表盘展示前5条）
const recentDocuments = computed(() => documents.value.slice(0, 5))
const getRecentDocTags = (doc: DocumentItem) => {
  const labels: Array<{ name: string; type: string }> = []
  const info = doc.projectInfo
  if (!info) return labels

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
}

// 文档搜索
const documentSearchKeyword = ref('')
const filteredDocuments = computed(() => {
  if (!documentSearchKeyword.value) return documents.value
  const kw = documentSearchKeyword.value.toLowerCase()
  return documents.value.filter(d => d.name.toLowerCase().includes(kw))
})

// ========== 重命名 ==========
const editingDocumentId = ref('')
const editingDocumentName = ref('')
const showRenameDialog = ref(false)

const createNewDocument = () => {
  requireAuth(() => router.push('/create'))
}

const openDocument = (docId: string) => {
  const url = router.resolve({ name: 'Editor', params: { id: docId } }).href
  window.open(url, '_blank')
}

const renameDocument = (docId: string) => {
  const doc = documents.value.find(d => d.id === docId)
  if (doc) {
    editingDocumentId.value = docId
    editingDocumentName.value = doc.name
    showRenameDialog.value = true
  }
}

const confirmRename = async () => {
  if (!editingDocumentName.value.trim()) {
    ElMessage.warning('请输入文档名称')
    return
  }

  const doc = documents.value.find(d => d.id === editingDocumentId.value)
  if (!doc) {
    ElMessage.error('文档不存在')
    return
  }

  const newName = editingDocumentName.value.trim()

  try {
    const result = await renameDocumentApi(editingDocumentId.value, newName)

    if (result.code === 200) {
      doc.name = newName
      doc.lastModified = new Date().toLocaleString('zh-CN')
      sortDocumentsByDate()
      showRenameDialog.value = false
      ElMessage.success(result.message || '文档重命名成功')
      await loadDocumentList()
    } else {
      ElMessage.error(result.message || '文档重命名失败')
    }
  } catch (error) {
    console.error('重命名文档失败:', error)
    ElMessage.error('文档重命名失败，请稍后重试')
  }
}

const deleteDocument = async (docId: string) => {
  const doc = documents.value.find(d => d.id === docId)
  if (!doc) return

  try {
    await ElMessageBox.confirm(
      `确定要删除文档"${doc.name}"吗？此操作不可恢复。`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    const result = await deleteDocumentApi(docId)

    if (result.code === 200) {
      documents.value = documents.value.filter(d => d.id !== docId)
      ElMessage.success(result.message || '文档删除成功')
      await loadDocumentList()
    } else {
      ElMessage.error(result.message || '文档删除失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除文档失败:', error)
      ElMessage.error('文档删除失败，请稍后重试')
    }
  }
}

const handleDocumentAction = (command: string, docId: string) => {
  switch (command) {
    case 'rename':
      renameDocument(docId)
      break
    case 'delete':
      deleteDocument(docId)
      break
    case 'export_md':
      exportDocument('md', docId)
      break
    case 'export_cad':
      exportDocument('cad', docId)
      break
  }
}

const exportDocument = async (format: string, docId?: string) => {
  const targetDocId = docId
  if (!targetDocId) {
    ElMessage.warning('请先选择要导出的文档')
    return
  }

  const targetDoc = documents.value.find(doc => doc.id === targetDocId)
  const docName = targetDoc?.name || '当前文档'

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

const showNotification = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
  ElNotification({ title: '提示', message, type, duration: 3000 })
}

// ========== 加载文档列表 ==========
const loadDocumentList = async () => {
  if (!userId.value) {
    loadingDocuments.value = false
    ElMessage.warning('无法获取用户信息，请重新登录')
    console.warn('userId is empty, cannot load document list')
    return
  }

  loadingDocuments.value = true
  try {
    const result = await getDocumentList({
      page: 1,
      pageSize: 20,
      userId: userId.value
    })

    if (result.code === 200 && result.data) {
      const convertedDocuments: DocumentItem[] = result.data.list.map((doc) => {
        let projectInfo: ProjectInfo | undefined
        try {
          const projectInfoStr = doc.projectInfo
          let tempInfo: any

          if (typeof projectInfoStr === 'string') {
            const parsed = JSON.parse(projectInfoStr)
            tempInfo = typeof parsed === 'string' ? JSON.parse(parsed) : parsed
          } else {
            tempInfo = projectInfoStr
          }

          if (tempInfo && typeof tempInfo === 'object' && tempInfo.projectInfo) {
            projectInfo = tempInfo.projectInfo
          } else {
            projectInfo = tempInfo
          }
        } catch (e) {
          console.warn('解析 projectInfo 失败:', e)
          projectInfo = undefined
        }

        const lastModified = doc.updatedAt
          ? new Date(doc.updatedAt).toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false
            }).replace(/\//g, '-')
          : new Date().toLocaleString('zh-CN')

        // 合并 localStorage 中的项目信息（标签等仅保存在本地）
        try {
          const localData = localStorage.getItem(`project_info_${doc.id}`)
          if (localData) {
            const localInfo = JSON.parse(localData)
            if (localInfo.professionTagId !== undefined || localInfo.businessTypeTagId !== undefined) {
              projectInfo = { ...(projectInfo || {} as ProjectInfo), ...localInfo }
            }
          }
        } catch {}

        return {
          id: doc.id,
          name: doc.name,
          lastModified: lastModified,
          status: 'draft' as const,
          isActive: false,
          projectInfo: projectInfo,
          outline: undefined
        }
      })

      documents.value = convertedDocuments
      sortDocumentsByDate()
    } else {
      ElMessage.error(result.message || '加载文档列表失败')
    }
  } catch (error) {
    console.error('加载文档列表失败:', error)
    ElMessage.error('加载文档列表失败，请稍后重试')
  } finally {
    loadingDocuments.value = false
  }
}

// ========== 移动端侧边栏 ==========
const showMobileSidebar = ref(false)

const toggleMobileSidebar = () => {
  showMobileSidebar.value = !showMobileSidebar.value
}

const closeMobileSidebar = () => {
  showMobileSidebar.value = false
}

// ========== 生命周期 ==========
onMounted(async () => {
  if (isAuthenticated()) {
    await loadAllTagsCache()
    await loadDocumentList()
  }
})
</script>

<template>
  <div class="home-page">
    <!-- 移动端遮罩 -->
    <div
      v-if="showMobileSidebar"
      class="sidebar-overlay"
      @click="closeMobileSidebar"
    />

    <!-- 顶部栏 -->
    <header class="main-header">
      <div class="main-header-left">
        <el-button :icon="Fold" link @click="toggleMobileSidebar" class="mobile-menu-btn" />
        <HeaderLogo />
      </div>
      <div class="main-header-right">
        <template v-if="isAuthenticated()">
          <UserDropdown show-name @command="handleUserCommand">
            <el-dropdown-item divided command="profile" :icon="User">
              个人信息
            </el-dropdown-item>
            <el-dropdown-item command="documents" :icon="Document">
              我的文档
            </el-dropdown-item>
            <el-dropdown-item command="license" :icon="Key">
              授权信息
            </el-dropdown-item>
            <el-dropdown-item divided command="help" :icon="QuestionFilled">
              <span>帮助与反馈</span>
            </el-dropdown-item>
            <el-dropdown-item  command="notifications" disabled :icon="Bell">
              <span>消息通知</span>
              <el-tag size="small" type="info" style="margin-left: 8px">待开发</el-tag>
            </el-dropdown-item>       
          </UserDropdown>
        </template>
        <template v-else>
          <el-button type="primary" size="small" @click="showLoginDialog = true">登录 / 注册</el-button>
        </template>
      </div>
    </header>

    <div class="home-body">
      <!-- 侧边栏 -->
      <aside
        class="home-sidebar"
      :class="{ 'mobile-visible': showMobileSidebar }"
    >
      <!-- 导航菜单 -->
      <nav class="sidebar-nav">
        <div v-for="group in menuGroups" :key="group.label" class="menu-group">
          <div class="menu-group-label">{{ group.label }}</div>

          <el-tooltip
            v-for="item in group.items"
            :key="item.key"
            :content="item.label"
            :disabled="true"
            placement="right"
          >
            <div
              class="sidebar-menu-item"
              :class="{
                active: activeView === item.key && item.action === 'view',
                'coming-soon': item.comingSoon
              }"
              @click="handleMenuClick(item); closeMobileSidebar()"
            >
              <el-icon :size="20"><component :is="item.icon" /></el-icon>
              <span class="menu-item-label">{{ item.label }}</span>
              <el-tag
                v-if="item.comingSoon"
                size="small"
                type="info"
                class="coming-soon-tag"
              >
                待开发
              </el-tag>
            </div>
          </el-tooltip>
        </div>
      </nav>
    </aside>

    <!-- 主内容 -->
    <main class="home-main-content">


      <!-- ===== Dashboard 视图 ===== -->
      <div v-if="activeView === 'dashboard'" class="dashboard-view">
        <!-- 欢迎横幅 -->
        <div class="welcome-banner">
          <div class="welcome-banner-content">
            <h1 class="welcome-title">
              {{ isAuthenticated() ? `${greetingTime}，${userDisplayName}` : '欢迎使用 AIAD 智绘设计' }}
            </h1>
            <p class="welcome-subtitle">
              AI驱动 + 知识库辅助，30分钟完成专业设计文档
            </p>
            <div class="welcome-tags">
              <span class="welcome-tag"><el-icon :size="14"><MagicStick /></el-icon> AI 智能生成</span>
              <span class="welcome-tag"><el-icon :size="14"><Edit /></el-icon> 可视化编辑</span>
              <span class="welcome-tag"><el-icon :size="14"><Reading /></el-icon> 知识库检索</span>
              <span class="welcome-tag"><el-icon :size="14"><ChatLineSquare /></el-icon> AI 助手</span>
            </div>
          </div>
          <div class="welcome-banner-visual" aria-hidden="true">
            <div class="visual-card visual-card-main"></div>
            <div class="visual-card visual-card-secondary"></div>
            <div class="visual-dots"></div>
          </div>
        </div>

        <!-- 快捷操作 -->
        <section class="quick-actions">
          <h3 class="section-label">快捷操作</h3>
          <div class="action-cards-grid">
            <div class="action-card" @click="handleMenuClick(findMenuItem('create'))">
              <div class="action-card-icon" style="background: #EFF6FF; color: #2563EB;">
                <el-icon :size="24"><EditPen /></el-icon>
              </div>
              <div class="action-card-body">
                <div class="action-card-title">新建文档</div>
                <div class="action-card-desc">创建新的施工图设计说明</div>
              </div>
            </div>
            <div class="action-card" @click="handleMenuClick(findMenuItem('documents'))">
              <div class="action-card-icon" style="background: #ECFDF5; color: #059669;">
                <el-icon :size="24"><Document /></el-icon>
              </div>
              <div class="action-card-body">
                <div class="action-card-title">我的文档</div>
                <div class="action-card-desc">查看和管理已有文档</div>
              </div>
            </div>
            <div class="action-card" @click="handleMenuClick(findMenuItem('qa'))">
              <div class="action-card-icon" style="background: #FFFBEB; color: #D97706;">
                <el-icon :size="24"><ChatLineRound /></el-icon>
              </div>
              <div class="action-card-body">
                <div class="action-card-title">规范问答</div>
                <div class="action-card-desc">AI智能规范检索与问答</div>
              </div>
            </div>
            <div class="action-card" @click="handleMenuClick(findMenuItem('templates'))">
              <div class="action-card-icon" style="background: #F5F3FF; color: #7C3AED;">
                <el-icon :size="24"><Files /></el-icon>
              </div>
              <div class="action-card-body">
                <div class="action-card-title">模板管理</div>
                <div class="action-card-desc">管理个人文档模板</div>
              </div>
            </div>
          </div>
        </section>

        <!-- 最近文档（仅已登录） -->
        <section v-if="isAuthenticated() && recentDocuments.length > 0" class="recent-documents">
          <div class="section-header-row">
            <h3 class="section-label">最近文档</h3>
            <div class="section-actions">
              <div class="view-toggle">
                <el-button
                  :icon="Grid"
                  size="small"
                  :type="recentDocsViewMode === 'grid' ? 'primary' : 'default'"
                  @click="recentDocsViewMode = 'grid'"
                />
                <el-button
                  :icon="List"
                  size="small"
                  :type="recentDocsViewMode === 'list' ? 'primary' : 'default'"
                  @click="recentDocsViewMode = 'list'"
                />
              </div>
              <el-button link type="primary" @click="handleMenuClick(findMenuItem('documents'))">查看全部</el-button>
            </div>
          </div>
          <DocumentCardList
            :documents="recentDocuments"
            :view-mode="recentDocsViewMode"
            show-tags
            show-footer-actions
            :get-doc-tags="getRecentDocTags"
            @open="openDocument"
            @action="handleDocumentAction"
          />
        </section>
      </div>

      <!-- ===== Documents 视图 ===== -->
      <div v-else-if="activeView === 'documents'" class="documents-view">
        <div class="documents-view-header">
          <h2>我的文档</h2>
          <el-button type="primary" :icon="Plus" @click="createNewDocument">新建文档</el-button>
        </div>

        <div class="documents-search-bar">
          <el-input
            v-model="documentSearchKeyword"
            placeholder="搜索文档..."
            clearable
            :prefix-icon="Search"
            style="flex: 1"
          />
          <div class="view-toggle" style="margin-left: 12px">
            <el-button
              :icon="Grid"
              size="small"
              :type="docsViewMode === 'grid' ? 'primary' : 'default'"
              @click="docsViewMode = 'grid'"
            />
            <el-button
              :icon="List"
              size="small"
              :type="docsViewMode === 'list' ? 'primary' : 'default'"
              @click="docsViewMode = 'list'"
            />
          </div>
        </div>

        <div v-loading="loadingDocuments" style="min-height: 200px">
          <DocumentCardList
            v-if="filteredDocuments.length > 0"
            :documents="filteredDocuments"
            :view-mode="docsViewMode"
            grid-min-width="280px"
            show-tags
            :get-doc-tags="getRecentDocTags"
            @open="openDocument"
            @action="handleDocumentAction"
          />

          <div v-else-if="!loadingDocuments" class="empty-documents">
            <el-empty description="暂无文档">
              <el-button type="primary" @click="createNewDocument">新建文档</el-button>
            </el-empty>
          </div>
        </div>
      </div>

      <!-- ===== Templates 视图 ===== -->
      <div v-else-if="activeView === 'templates'" class="templates-view">
        <Settings @navigate="handleSettingsNavigate" />
      </div>

      <!-- ===== QA 视图 ===== -->
      <div v-else-if="activeView === 'qa' && !activeViewItem?.comingSoon" class="qa-view">
        <ProjectQA />
      </div>

      <!-- ===== Memory Management 视图 ===== -->
      <div v-else-if="activeView === 'memory'" class="memory-view">
        <MemoryManagement />
      </div>

      <!-- ===== Standard Clauses 视图 ===== -->
      <div v-else-if="activeView === 'clauses'" class="clauses-view">
        <StandardClauses />
      </div>

      <!-- ===== Review 视图 ===== -->
      <div v-else-if="activeView === 'review'" class="review-view">
        <ReviewList />
      </div>

      <div v-else-if="activeView === 'help'" class="help-view">
        <HelpCenter />
      </div>

      <!-- ===== Coming Soon 视图 ===== -->
      <div v-else-if="activeViewItem?.comingSoon" class="coming-soon-view">
        <el-empty description="待开发，敬请期待" :image-size="160">
          <template #description>
            <div class="coming-soon-text">
              <p class="coming-soon-title">{{ activeViewItem?.label }}</p>
              <p class="coming-soon-desc">待开发，敬请期待</p>
            </div>
          </template>
        </el-empty>
      </div>
    </main>
    </div>

    <!-- 登录弹窗 -->
    <LoginDialog
      v-model:visible="showLoginDialog"
      @success="onLoginSuccess"
      @cancel="onLoginCancel"
    />

    <!-- 个人信息弹窗 -->
    <ProfileDialog
      v-model:visible="showProfileDialog"
      @updated="refreshUserInfo"
    />

    <!-- 授权信息弹窗 -->
    <LicenseInfoDialog
      v-model:visible="showLicenseDialog"
    />

    <!-- 重命名文档对话框 -->
    <el-dialog
      v-model="showRenameDialog"
      title="重命名文档"
      width="400px"
      :close-on-click-modal="false"
    >
      <el-form>
        <el-form-item label="文档名称">
          <el-input
            v-model="editingDocumentName"
            placeholder="请输入文档名称"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showRenameDialog = false">取消</el-button>
          <el-button type="primary" @click="confirmRename">确定</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* ===== 整体布局 ===== */
.home-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.home-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  width: 100%;
}

/* ===== 侧边栏 ===== */
.home-sidebar {
  width: 220px;
  min-width: 220px;
  background: #fff;
  border-right: 1px solid var(--gray-200);
  display: flex;
  flex-direction: column;
  z-index: 100;
  overflow: hidden;
}

/* 导航菜单 */
.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  scrollbar-width: thin;
  scrollbar-color: var(--gray-200) transparent;
}

.menu-group {
  margin-bottom: 4px;
}

.menu-group-label {
  padding: 12px 20px 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--gray-400);
  text-transform: uppercase;
  letter-spacing: 0.6px;
}

.sidebar-menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  margin: 1px 8px;
  cursor: pointer;
  color: var(--gray-600);
  font-size: 14px;
  transition: all 0.15s ease;
  border-radius: 8px;
  white-space: nowrap;
}

.sidebar-menu-item:hover {
  background: var(--gray-50);
  color: var(--primary-color);
}

.sidebar-menu-item.active {
  background: var(--primary-light, #E6F2FF);
  color: var(--primary-color);
  font-weight: 600;
}

.sidebar-menu-item.coming-soon {
  opacity: 0.55;
}

.sidebar-menu-item.coming-soon:hover {
  opacity: 0.8;
}

.menu-item-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.coming-soon-tag {
  margin-left: auto;
  font-size: 10px;
  flex-shrink: 0;
  padding: 0 6px;
  height: 18px;
  line-height: 18px;
  border-radius: 4px;
}

/* ===== 顶部栏 ===== */
.home-main-content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  background: var(--gray-50, #f9fafb);
  display: flex;
  flex-direction: column;
}

.main-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 32px;
  background: linear-gradient(135deg, #ffffff 0%, #fafbfc 100%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  position: sticky;
  top: 0;
  z-index: 50;
  height: 56px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  backdrop-filter: blur(10px);
}

.main-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.main-header-left .mobile-menu-btn {
  display: none;
}

.main-header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mobile-menu-btn {
  font-size: 20px;
  color: var(--gray-700);
}

/* ===== Dashboard 视图 ===== */
.dashboard-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 28px 40px;
}

/* 欢迎横幅 */
.welcome-banner {
  background: linear-gradient(135deg, #0078D4 0%, #00BCF2 100%);
  border-radius: 16px;
  padding: 36px 40px;
  margin-bottom: 28px;
  color: white;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 28px;
}

.welcome-banner-content {
  position: relative;
  z-index: 1;
  max-width: 640px;
}

.welcome-title {
  font-size: 26px;
  font-weight: 700;
  margin: 0 0 8px;
  line-height: 1.3;
}

.welcome-subtitle {
  font-size: 15px;
  opacity: 0.9;
  margin: 0 0 16px;
  line-height: 1.5;
}

.welcome-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.welcome-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.18);
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(4px);
}

.welcome-banner-visual {
  position: relative;
  width: 280px;
  height: 170px;
  flex-shrink: 0;
}

.visual-card {
  position: absolute;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.28);
  backdrop-filter: blur(6px);
}

.visual-card-main {
  width: 200px;
  height: 140px;
  right: 0;
  top: 12px;
  box-shadow: 0 16px 28px rgba(0, 0, 0, 0.15);
}

.visual-card-secondary {
  width: 140px;
  height: 100px;
  right: 140px;
  top: 34px;
  opacity: 0.7;
}

.visual-dots {
  position: absolute;
  left: 18px;
  bottom: 16px;
  width: 84px;
  height: 84px;
  background-image: radial-gradient(rgba(255, 255, 255, 0.45) 1px, transparent 1px);
  background-size: 10px 10px;
  opacity: 0.7;
}

/* Section 标题 */
.section-label {
  font-size: 16px;
  font-weight: 600;
  color: var(--gray-800);
  margin: 0 0 16px;
}

.section-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header-row .section-label {
  margin: 0;
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.view-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid var(--gray-200);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

/* 快捷操作 */
.quick-actions {
  margin-bottom: 28px;
}

.action-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.action-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid var(--gray-200);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.action-card:hover {
  border-color: var(--primary-color);
  box-shadow: 0 4px 12px rgba(0, 120, 212, 0.1);
  transform: translateY(-2px);
}

.action-card.coming-soon {
  opacity: 0.6;
}

.action-card.coming-soon:hover {
  opacity: 0.85;
  transform: none;
  box-shadow: none;
  border-color: var(--gray-200);
}

.action-card-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.action-card-body {
  min-width: 0;
}

.action-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--gray-900);
  margin-bottom: 4px;
}

.action-card-desc {
  font-size: 12px;
  color: var(--gray-500);
  line-height: 1.4;
}

/* 最近文档 */
.recent-documents {
  min-width: 0;
}

.recent-docs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.recent-doc-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid var(--gray-200);
  transition: all 0.2s ease;
}

.recent-doc-main {
  min-width: 0;
}

.recent-doc-card:hover {
  border-color: var(--primary-color);
  box-shadow: 0 4px 12px rgba(0, 120, 212, 0.1);
}

.recent-doc-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.recent-doc-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--primary-light, #E6F2FF);
  color: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.recent-doc-action-btn {
  color: var(--gray-400);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.recent-doc-card:hover .recent-doc-action-btn,
.recent-docs-table-row:hover .recent-doc-action-btn {
  opacity: 1;
}

.recent-doc-action-btn:hover {
  color: var(--primary-color);
}

.recent-doc-card-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--gray-900);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}

.recent-doc-card-name:hover {
  color: var(--primary-color);
}

.recent-doc-card-time {
  font-size: 12px;
  color: var(--gray-400);
  margin-bottom: 14px;
}

.recent-doc-card-footer {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--gray-100);
}

.recent-docs-table {
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: 12px;
  overflow: hidden;
}

.recent-docs-table-header,
.recent-docs-table-row {
  display: grid;
  grid-template-columns: 2.2fr 1.2fr 1.6fr 0.6fr;
  align-items: center;
  column-gap: 16px;
  padding: 12px 16px;
}

.recent-docs-table-header {
  background: var(--gray-50);
  font-size: 12px;
  font-weight: 600;
  color: var(--gray-500);
}

.recent-docs-table-row {
  cursor: pointer;
  transition: background 0.15s ease;
  border-top: 1px solid var(--gray-100);
}

.recent-docs-table-row:hover {
  background: rgba(0, 120, 212, 0.04);
}

.table-col {
  min-width: 0;
}

.col-actions {
  display: flex;
  justify-content: flex-end;
}

.doc-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.doc-name-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--gray-900);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.doc-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.doc-tag-empty {
  font-size: 12px;
  color: var(--gray-400);
}

/* ===== Documents 视图 ===== */
.documents-view {
  padding: 28px 32px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}

.documents-view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.documents-view-header h2 {
  font-size: 22px;
  font-weight: 600;
  color: var(--gray-900);
  margin: 0;
}

.documents-search-bar {
  margin-bottom: 20px;
  max-width: 420px;
  display: flex;
  align-items: center;
}

.documents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  min-height: 200px;
}

.document-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid var(--gray-200);
  cursor: pointer;
  transition: all 0.2s ease;
}

.document-card:hover {
  border-color: var(--primary-color);
  box-shadow: 0 4px 12px rgba(0, 120, 212, 0.1);
  transform: translateY(-2px);
}

.document-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.document-card-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--primary-light, #E6F2FF);
  color: var(--primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
}

.doc-action-btn {
  color: var(--gray-400);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.document-card:hover .doc-action-btn {
  opacity: 1;
}

.doc-action-btn:hover {
  color: var(--primary-color);
}

.document-card-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--gray-900);
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.document-card-time {
  font-size: 12px;
  color: var(--gray-400);
}

.danger-item {
  color: var(--error-color, #EF4444);
}

.empty-documents {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
}

/* ===== Templates 视图 ===== */
.templates-view {
  padding: 28px 32px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
  height: calc(100% - 56px);
}

/* ===== Memory 视图 ===== */
.memory-view {
  padding: 28px 32px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}

/* ===== Clauses 视图 ===== */
.clauses-view {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ===== QA 视图 ===== */
.qa-view {
  padding: 0;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* ===== Review 视图 ===== */
.review-view {
  padding: 28px 32px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

/* ===== Coming Soon 视图 ===== */
.coming-soon-view {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px;
}

.coming-soon-text {
  text-align: center;
}

.coming-soon-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--gray-700);
  margin: 0 0 8px;
}

.coming-soon-desc {
  font-size: 14px;
  color: var(--gray-400);
  margin: 0;
}

/* ===== 移动端遮罩 ===== */
.sidebar-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 150;
}

/* ===== 响应式 ===== */

/* 大屏 */
@media (min-width: 1440px) {
  .dashboard-view {
    padding: 32px 56px;
  }
}

/* 中屏 */
@media (max-width: 1024px) {
  .action-cards-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* 平板及以下 */
@media (max-width: 768px) {
  /* 侧边栏改为固定浮层 */
  .home-sidebar {
    position: fixed;
    left: 0;
    top: 0;
    height: 100vh;
    z-index: 200;
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.15);
    transform: translateX(-100%);
    transition: transform 0.25s ease;
  }

  .home-sidebar.mobile-visible {
    transform: translateX(0);
  }

  .sidebar-overlay {
    display: block;
  }

  .main-header-left {
    display: flex;
  }

  .main-header {
    justify-content: space-between;
    padding: 12px 16px;
  }

  .dashboard-view {
    padding: 20px 16px;
  }

  .documents-view {
    padding: 20px 16px;
  }

  .action-cards-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .action-card {
    padding: 16px;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 10px;
  }

  .documents-grid {
    grid-template-columns: 1fr;
  }

  .documents-search-bar {
    max-width: 100%;
  }

  .welcome-banner {
    border-radius: 12px;
    padding: 24px 20px;
    flex-direction: column;
    align-items: flex-start;
  }

  .welcome-banner-visual {
    display: none;
  }

  .welcome-title {
    font-size: 20px;
  }

  .welcome-tags {
    gap: 8px;
  }

  .welcome-tag {
    font-size: 12px;
    padding: 3px 10px;
  }

  .recent-docs-grid {
    grid-template-columns: 1fr;
  }

  .recent-docs-table {
    overflow-x: auto;
  }

  .recent-docs-table-header,
  .recent-docs-table-row {
    min-width: 640px;
  }

  .section-actions {
    flex-direction: column;
    align-items: flex-start;
  }
}

/* 小屏手机 */
@media (max-width: 480px) {
  .action-cards-grid {
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .action-card {
    padding: 14px 10px;
  }

  .action-card-icon {
    width: 36px;
    height: 36px;
  }

  .welcome-tags {
    flex-direction: column;
    gap: 6px;
  }
}
</style>
