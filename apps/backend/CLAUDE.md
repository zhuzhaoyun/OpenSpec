# ArchSpec Java 后端

## 技术栈
- **框架**: Spring Boot 3.1.5 + Java 17
- **ORM**: MyBatis-Plus
- **数据库**: PostgreSQL 15
- **包名**: `com.aiid.aidoc`
- **启动**: `cd apps/backend && mvn spring-boot:run -pl ai-doc-system-rest` → http://localhost:8080

## 模块架构

```
apps/backend/
├── ai-doc-system-api/          # API 接口定义 (DTO/VO)
│   └── com.aiid.aidoc.api.dto
├── ai-doc-system-model/        # 数据模型 (Entity)
│   └── com.aiid.aidoc.model.entity
├── ai-doc-system-repository/   # 数据访问层 (Mapper)
│   └── com.aiid.aidoc.repository.mapper
├── ai-doc-system-service/      # 业务逻辑层
│   └── com.aiid.aidoc.service / .impl
├── ai-doc-system-rest/         # REST 控制器 (主运行模块)
│   └── com.aiid.aidoc.controller
├── ai-doc-system-license/      # License 授权校验 (商业版, ProGuard 混淆)
├── ai-doc-system-license-gen/  # License 生成工具 (商业版)
├── ai-doc-system-template/     # 模板管理 (商业版, ProGuard 混淆)
└── keys/                       # RSA 密钥对 (不提交)
```

## 用户认证模块

### JWT 鉴权
- **签发**: `JwtUtil.java` — 含 userId, email，7天有效期
- **验证**: `JwtAuthFilter.java` — 拦截所有 `/api/v1/**` 请求，注入 userId 到 request attribute
- **注册**: `FilterConfig.java` 注册 Filter
- **密码加密**: BCryptPasswordEncoder

### 用户 API

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| POST | `/api/v1/user/register` | 公开 | 邮箱注册 |
| POST | `/api/v1/user/login` | 公开 | 登录，返回 JWT |
| GET | `/api/v1/user/info` | JWT | 获取当前用户信息 |

### 相关文件
- Entity: `ai-doc-system-model/.../model/entity/User.java`
- Mapper: `ai-doc-system-repository/.../repository/mapper/UserMapper.java`
- Service: `ai-doc-system-service/.../service/UserService.java`, `impl/UserServiceImpl.java`
- DTO: `RegisterRequest.java`, `LoginRequest.java`, `LoginResponse.java`
- Controller: `ai-doc-system-rest/.../controller/UserController.java`
- JWT: `ai-doc-system-rest/.../config/JwtUtil.java`, `JwtAuthFilter.java`, `FilterConfig.java`

## 数据库

- **数据库名**: `doc_generator`
- **Schema 管理**: `script/backend/initial_schema.sql`
- **Docker**: 自动挂载到 `/docker-entrypoint-initdb.d/`
- **驱动**: `org.postgresql.Driver`

## 标签系统

- 两个维度：`profession` (专业) + `business_type` (业态)，每类单选
- 表：`template_tags`（标签定义）、`document_template_tags`（关联）
- 关联文件：TemplateTag entity, DocumentTemplateTag entity, TemplateTagController

## License 授权 (商业版)

- RSA 签名 License 文件，模板管理功能需有效授权
- API: `GET /api/v1/license/status` — 获取授权状态
- 开源版发布时移除 `ai-doc-system-license-gen/`、`keys/private.key`、源码

## OSS 对象存储（审查文件上传）

- **模式**: 服务端签名、浏览器直传
- **签名方式**: OSS V4 PostObject 签名 (HMAC-SHA256 四级密钥派生)
- **配置类**: `OssProperties.java` — `@ConfigurationProperties("oss")`（已下沉到 service 模块，共享给上传签名与 source-access）
- **控制器**: `OssSignatureController.java` — `GET /api/v1/oss/upload-signature` (JWT 鉴权)
- **控制器**: `ReviewController.java` — `GET /api/v1/reviews/{id}/source-access`（仅 owner，返回短期 OSS 读取 URL）
- **实现要点**: source-access 先校验审查记录归属；`ossFileKey` 缺失按 500 数据/配置错误处理，不再伪装成 404；签名 URL 直接按最终访问 host/endpoint 生成；`OSS_ENDPOINT` / `OSS_HOST` 如果落到 `*.aliyuncs.com` bucket host，会先归一化到 regional endpoint 再签名，只有真正的 custom/browser host 才启用 OSS CNAME 支持；source-access 读取 URL 显式使用 OSS4(V4) 预签名并携带 region；`expiresAt` 返回带时区的绝对时间戳（`Instant` / UTC）
- **环境变量**: `OSS_ACCESS_KEY_ID`, `OSS_ACCESS_KEY_SECRET`, `OSS_BUCKET`, `OSS_REGION`, `OSS_HOST`, `OSS_UPLOAD_DIR`, `OSS_ENDPOINT`, `OSS_EXPIRE_SECONDS`
- **容器部署**: `docker-compose.yml` 中 backend 服务需配置所有 OSS 环境变量
- **浏览器读取前提**: OSS bucket 需放行前端 origin 的 `GET` / `HEAD` CORS；当前仓库未见桶级 CORS 配置，前端接入时需补充部署侧规则

## 审查记录接口

- `POST /api/v1/reviews` 只接收审查维度、规范 ID、严格度、文档名和 `ossFileKey`，且两者都仅允许 `.md` / `.txt`
- `GET /api/v1/reviews/{id}` 仅返回当前登录用户自己的记录，响应中不再包含 `content`
- `GET /api/v1/reviews/{id}/source-access` 仅返回 owner 的短期 OSS 读取信息，不直接返回文件内容
