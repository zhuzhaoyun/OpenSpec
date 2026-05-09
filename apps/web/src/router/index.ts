import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import Home from '../views/Home.vue'
import CreateDocument from '../views/CreateDocument.vue'
import Editor from '../views/Editor.vue'
import Register from '../views/Register.vue'
import ProjectQA from '../views/ProjectQA.vue'
import Settings from '../views/Settings.vue'
import StandardReview from '../views/StandardReview.vue'
import ReviewList from '../views/ReviewList.vue'
import ReviewResult from '../views/ReviewResult.vue'
import StandardClauses from '../views/StandardClauses.vue'
import TemplateDetail from '../views/TemplateDetail.vue'
import { authStorage } from '../utils/auth'

const routes: RouteRecordRaw[] = [
  // 登录页已合并到 Home 的 LoginDialog，旧路径重定向到首页
  {
    path: '/login',
    redirect: '/home'
  },

  // 注册页保留
  {
    path: '/register',
    name: 'Register',
    component: Register,
    meta: { requiresAuth: false }
  },

  // 主页（新增）
  {
    path: '/',
    redirect: '/home'
  },
  {
    path: '/home',
    name: 'Home',
    component: Home,
    meta: { requiresAuth: false }
  },

  // 文档新建（新增）
  {
    path: '/create',
    name: 'CreateDocument',
    component: CreateDocument,
    meta: { requiresAuth: true }
  },

  // 文档编辑（精简，id 必填）
  {
    path: '/editor/:id',
    name: 'Editor',
    component: Editor,
    meta: { requiresAuth: true }
  },

  // 其他保持不变
  {
    path: '/qa',
    name: 'ProjectQA',
    component: ProjectQA,
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: Settings,
    meta: { requiresAuth: true }
  },
  {
    path: '/review',
    name: 'ReviewList',
    component: ReviewList,
    meta: { requiresAuth: true }
  },
  {
    path: '/review/new',
    name: 'StandardReview',
    component: StandardReview,
    meta: { requiresAuth: true }
  },
  {
    path: '/review/:id',
    name: 'ReviewResult',
    component: ReviewResult,
    meta: { requiresAuth: true }
  },
  {
    path: '/clauses',
    name: 'StandardClauses',
    component: StandardClauses,
    meta: { requiresAuth: true }
  },
  {
    path: '/template/:id',
    name: 'TemplateDetail',
    component: TemplateDetail,
    meta: { requiresAuth: true }
  },

  // 兜底
  {
    path: '/:pathMatch(.*)*',
    redirect: '/home'
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// 路由守卫：检查登录状态
router.beforeEach((to, from, next) => {
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const isAuthenticated = authStorage.isAuthenticated()

  // 如果路由需要认证但用户未登录，重定向到首页（由 Home 的 LoginDialog 处理登录）
  if (requiresAuth && !isAuthenticated) {
    next('/home')
  }
  else {
    next()
  }
})

export default router
