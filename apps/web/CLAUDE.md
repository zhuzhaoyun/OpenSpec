# ArchSpec Web 前端

## 技术栈
- **框架**: Vue 3 + TypeScript + Composition API
- **构建工具**: Vite
- **UI 组件库**: Element Plus
- **路由**: Vue Router 4
- **启动**: `cd apps/web && npm run dev` → http://localhost:5173

## 项目结构

```
apps/web/
├── src/
│   ├── assets/            # 资源文件
│   ├── components/        # 公共组件
│   ├── composables/       # 组合式函数 (useLogin, useLogout)
│   ├── router/            # 路由配置
│   ├── service/           # API 服务层
│   │   ├── user.ts        # 用户认证 (注册/登录/用户信息)
│   │   ├── document.ts    # 文档管理
│   │   ├── template.ts    # 模板管理
│   │   ├── ragflow.ts     # RAGFlow 对话
│   │   ├── workflow.ts    # Workflow 对话
│   │   └── memory.ts      # 长期记忆管理
│   ├── utils/
│   │   └── auth.ts        # authFetch 封装 + getAuthHeaders
│   └── views/             # 页面
│       ├── Login.vue
│       ├── Register.vue
│       ├── Home.vue
│       ├── Editor.vue     # 主编辑器 (含新建文档向导)
│       ├── Settings.vue   # 设置 (标签管理/记忆管理)
│       └── TemplateMarket.vue / TemplateDetail.vue
├── .env.local             # 环境变量 (Vite proxy)
└── vite.config.ts
```

## 用户认证 (前端)

### 认证流程
1. 用户登录/注册 → 调用 `/api/v1/user/*` → 获取 JWT
2. JWT 存入 `localStorage`，格式：`Authorization: Bearer <JWT>`
3. 所有 API 请求通过 `authFetch()` 或 `getAuthHeaders()` 携带 JWT
4. 401 响应 → 自动清除 token → 跳转登录页
5. 退出登录 → 仅清除本地 token（JWT 无状态）

### 两种请求封装
- **authFetch** (`utils/auth.ts`): 通用封装，自动注入 JWT + 401 拦截，用于 agent 接口调用
  - 使用者: `ragflow.ts`、`workflow.ts`、`Settings.vue`、`TemplateDetail.vue`
- **getAuthHeaders()**: 仅获取认证头，由各 service 自行处理
  - 使用者: `document.ts`、`template.ts`、`personalTemplate.ts`

## 核心页面

| 页面 | 文件 | 功能 |
|---|---|---|
| 登录 | `Login.vue` | 邮箱登录，JWT 存储 |
| 注册 | `Register.vue` | 邮箱注册 |
| 首页 | `Home.vue` | 项目列表 |
| 编辑器 | `Editor.vue` | 主编辑器 + 新建文档向导 (选择专业/业态标签) |
| 设置 | `Settings.vue` | 标签管理 + 记忆管理 |
| 模板市场 | `TemplateMarket.vue` | 模板浏览 |
| 模板详情 | `TemplateDetail.vue` | 模板编辑 |
| 审查 | `StandardReview.vue` | 规范审查创建 + OSS 文件直传 |
| 审查列表 | `ReviewList.vue` | 基于后端分页记录展示审查文件名/时间/维度/状态；`processing` / `running` 显示处理中态；列表加载失败显示错误/重试态 |
| 审查结果 | `ReviewResult.vue` | 只读结果页；先取 detail，再取 `source-access` 并在浏览器读取 OSS 文本；区分 not-found 与通用加载失败；`pending` / `processing` / `running` 记录只展示原文不展示问题高亮/问题清单；`completed` / `all_handled` 才显示完成态结果并允许导出报告 |

## OSS 文件上传（审查页）

- **模式**: 服务端签名、浏览器直传（选文件即上传）
- **Service**: `reviewService.ts` — `createReviewApi()`, `getReviewListApi()`, `getReviewApi()`, `getReviewSourceAccessApi()`, `getOssUploadSignature()`, `uploadFileToOss()`
- **流程**: 选文件 → 获取签名 `GET /api/v1/oss/upload-signature` → POST 直传 OSS → 存储 ossFileKey
- **状态展示**: `idle` → `uploading` → `uploaded` / `failed`
- **无效选择**: 选择不支持格式、超限文件或触发 exceed 时会清空已上传状态，避免旧文件继续可创建
- **结果页回显**: `ReviewResult.vue` 先调 `getReviewApi()` 拉元数据，再调 `getReviewSourceAccessApi()` 获取短期 signed URL 并直接 `fetch(accessUrl)` 读取 OSS 文本；signed URL 读取失败时会重新为当前加载中的同一条记录申请一次 `source-access`；若记录缺少 `ossFileKey`，页面明确展示“缺少可回显源文件”，不再回退 DB `content`；`pending` / `processing` / `running` 记录只保留原文浏览，不会渲染问题高亮、统计卡片或问题清单；`getReviewApi()` / `getReviewSourceAccessApi()` 仅按后端 JSON `code === 404` 渲染未找到态，OSS `fetch(accessUrl)` 的 404 仍按源文件加载失败处理
- **审查列表**: `ReviewList.vue` 的概览指标“当前页待处理审查数”统计当前页仍处于 `pending` / `processing` / `running` 的记录数；列表状态展示与结果页保持一致，`completed` / `all_handled` 统一显示为已完成

## 标签系统 (前端)

- 新建文档向导中用户选择专业 (profession) + 业态 (business_type) 标签
- 每类单选，存储在 `ProjectInfo.professionTagId` / `businessTypeTagId`
- 标签管理在 `Settings.vue` 中

## AI 对话组件

`ChatAssistant.vue` - 章节生成对话面板：
- 模板匹配展示
- 记忆召回展示（"已参考 N 条历史偏好"，可折叠查看详情）
- 流式生成进度
