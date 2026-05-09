# ArchSpec AI Agent

## 技术栈
- **框架**: FastAPI (Python 3.10+)
- **RAG Engine**: RAGFlow (via API)
- **Workflow**: LangGraph
- **Prompt Management**: Langfuse
- **LLM**: 千问 (dashscope SDK) + Langfuse/LiteLLM
- **启动**: `cd apps/agent && python app.py` → http://localhost:5000

## 目录结构

```
apps/agent/
├── api/                    # API 路由
│   ├── rag_api.py          # RAG 生成/提取接口
│   ├── workflow_api.py     # Workflow 编排接口
│   ├── template_api.py     # 模板匹配接口
│   ├── file_api.py         # 文件管理 + RAGFlow 元数据
│   └── memory_api.py       # 长期记忆管理 API
├── middleware/
│   └── jwt_auth.py         # JWT 认证中间件 (白名单: /docs, /openapi.json, /agent/test)
├── service/
│   ├── rag/                # RAG 服务 (rag_service_ragflow.py, extract_info.py)
│   ├── workflow/           # LangGraph 工作流 (rag_graph.py)
│   ├── memory/             # 长期记忆 (embedding_service.py, memory_service.py, extraction_service.py)
│   └── template_matcher.py # 模板匹配
├── utils/
│   └── basePrompt.py       # Prompt 模板
└── app.py                  # 应用入口
```

## JWT 中间件

- `middleware/jwt_auth.py` — 验证 JWT，将 `user_id` 存入 `request.state.user_id`
- 白名单: `/docs`, `/openapi.json`, `/redoc`, `/agent/test`
- 与 Java 后端共享 `JWT_SECRET` 环境变量

## 主要 API

### RAG 引擎
- `POST /agent/rag/ragflow/chat_stream` — RAGFlow 知识库对话 (SSE 流式)
- `POST /agent/rag/generate_paragraph_stream` — 段落生成 (含记忆保存)

### Workflow 引擎
- `POST /agent/workflow/chat/stream` — 多 Agent 编排对话 (SSE 流式)
- `POST /agent/workflow/chat/batch` — 批量生成

### 文件管理
- `POST /agent/file/set_meta_fields` — 设置 RAGFlow 文档元数据 (profession/business_type 标签)

### 长期记忆
- `GET /agent/memory/list` — 查看记忆列表
- `POST /agent/memory/recall` — 语义召回记忆
- `DELETE /agent/memory/{id}` — 删除单条记忆

## 长期记忆功能

### 架构
- **存储**: PostgreSQL pgvector (`user_memory` 表，启动时自动建表)
- **Embedding**: 千问 text-embedding-v3 (1024维, dashscope SDK)
- **去重**: 相似度 > 0.9 跳过
- **分类**: LLM 自动分类 (material_preference / design_parameter / standard_reference / style_preference / other)

### 记忆写入
- workflow batch/stream 接口：从 `project_info` 中提取"编写要求"自动保存
- rag_api `generate_paragraph_stream`：从 `requirement` 字段自动保存

### 记忆召回
- workflow 接口生成前，按章节名称召回相关记忆
- 注入到 `project_info` 的【历史偏好记忆】块
- stream 端点：流开始前发送 `memory_recalled` SSE 事件
- batch 端点：响应中返回 `recalled_memories` 字段

### 参数
- `memory_window`: 天数限制
- `memory_chapters`: 章节过滤

## 标签系统

- RAGFlow 元数据分字段存储：`meta_fields['profession']` = 标签ID, `meta_fields['business_type']` = 标签ID
- 模板匹配 (`template_matcher.py`)：按 profession/business_type 后过滤
- 通过 `/agent/file/set_meta_fields` 接口写入

## Prompt 管理

所有 Prompt 模板集中在 `utils/basePrompt.py`，通过 Langfuse 进行版本控制。
