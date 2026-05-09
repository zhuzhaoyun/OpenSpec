<h1 align="center">OpenSpec</h1>

<p align="center">
  <strong>企业级 AI 长文档生成与智能审查平台</strong>
</p>

<p align="center">
  集专业长文档生成与 Agent 智能审查于一体 —— 从数天缩短到数分钟。
</p>

<p align="center">
  <a href="./README_zh.md">中文</a> |
  <a href="./README_en.md">English</a>
</p>

<p align="center">
  <a href="https://github.com/zhuzhaoyun/OpenSpec/releases/latest"><img src="https://img.shields.io/github/v/release/zhuzhaoyun/OpenSpec" alt="Latest Release"></a>
  <a href="https://github.com/zhuzhaoyun/OpenSpec/blob/main/LICENSE"><img src="https://img.shields.io/github/license/zhuzhaoyun/OpenSpec?color=blue" alt="License"></a>
  <a href="https://github.com/zhuzhaoyun/OpenSpec"><img src="https://img.shields.io/github/stars/zhuzhaoyun/OpenSpec?style=social" alt="GitHub Stars"></a>
  <a href="https://github.com/zhuzhaoyun/OpenSpec/fork"><img src="https://img.shields.io/github/forks/zhuzhaoyun/OpenSpec?style=social" alt="GitHub Forks"></a>
  <a href="https://github.com/zhuzhaoyun/OpenSpec/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"></a>
</p>

<p align="center">
  <a href="https://archspec.aizzyun.com/">在线体验</a> &bull;
  <a href="https://www.bilibili.com/video/BV1DoFUzBEmW/">视频介绍</a> &bull;
  <a href="#快速开始">快速开始</a> &bull;
  <a href="#联系我们">联系我们</a>
</p>

---

## 为什么选择 OpenSpec？

通用 AI（ChatGPT、Claude、通义千问等）在专业长文档上力不从心：

| 问题 | 通用 AI | OpenSpec |
|------|:-------:|:--------:|
| 超过 50 页的文档 | 上下文丢失，前后矛盾 | 逐章生成，全篇连贯 |
| 行业标准与规范引用 | 幻觉严重，凭空编造 | RAG 检索你自己的知识库 |
| 文档格式与模板 | 无法控制排版 | PDF / Markdown / AutoCAD 导出 |
| 质量保障 | 单次生成，无审核 | 三智能体工作流（Researcher + Generator + Auditor） |
| 规范条文审查 | 无法逐条对照、容易遗漏 | Agent 驱动的智能审查模块，逐条校验 |

**OpenSpec 不是又一个 AI 写作工具。** 它是一个为专业人士打造的文档工程平台，集长文档生成与智能审查于一体，确保准确性、合规性和规模化生产。

## 工作原理

### 长文档生成 — 三智能体工作流

<img src="docs/长文本生成智能体架构图.png" alt="长文生成架构" width="600" />

系统由**三智能体工作流**驱动，每个智能体在发现当前上下文不足时，会自主查询知识库获取补充信息：

1. **Researcher（检索智能体）** — 从知识库中检索相关规范条文、历史案例和参考资料，构建扎实的研究基础
2. **Generator（生成智能体）** — 基于检索上下文，逐章生成符合行业标准的专业内容
3. **Auditor（校验智能体）** — 审核生成内容的合规性、一致性和准确性；按需查询知识库进行交叉验证，发现问题则回传 Generator 修订
4. **人机协作** — 支持逐章校审、改写、补充
5. **一键导出** — PDF、Markdown、AutoCAD 图框等多种专业格式

### 智能审查 — Agent 驱动的独立审查模块

<img src="docs/文件审查时序图.png" alt="文本审查时序图" width="600" />

**审查模块**是一个以 Agent 为中心的独立子系统，具备广泛的领域适应性，不局限于特定行业：

- **条文录入与管理** — 支持任意行业规范、标准、合同条款的结构化录入
- **Agent 逐条审查** — 智能体自动对照条文与文档内容，逐条分析合规性
- **不符项自动标识** — 精准定位问题位置，生成审查意见与修改建议
- **多领域适配** — 通过配置即可适配建筑、医疗、法律、金融等不同行业的审查需求
- **审查报告导出** — 一键生成带批注的审查报告，支持追溯与归档

## 适用场景

| 领域 | 典型文档 |
|------|---------|
| 建筑设计 | 施工图设计说明、可行性研究报告、设计规范审查 |
| 汽车维修 | 维修技术手册、故障诊断报告 |
| 医疗健康 | 临床试验报告、诊疗规范文档、合规审查 |
| 法律金融 | 合同审查、合规报告、政策条文核对 |
| 招投标 | 投标技术方案、招标文件编制、合规性审查 |
| **更多领域** | **任何需要基于知识库生成的结构化长文档，以及规范/条款的智能审查** |

## UI 展示

<table style="border-collapse: collapse; border: 1px solid black;">
  <tr>
    <td style="padding: 5px;background-color:#fff;"><img src="https://github.com/user-attachments/assets/2d67e1a4-a779-43b7-a770-a07deb649711" alt="项目列表" /></td>
    <td style="padding: 5px;background-color:#fff;"><img src="https://github.com/user-attachments/assets/efcae9fa-bf8d-4b53-93f6-2d49e6119042" alt="文档编辑器" /></td>
  </tr>
  <tr>
    <td style="padding: 5px;background-color:#fff;"><img src="https://github.com/user-attachments/assets/889a30b5-d014-46ca-84e4-26334f6076ba" alt="AI 对话助手" /></td>
    <td style="padding: 5px;background-color:#fff;"><img src="https://github.com/user-attachments/assets/1b04355c-709a-4a33-9e39-ac7d04ce483c" alt="知识库检索" /></td>
  </tr>
  <tr>
    <td style="padding: 5px;background-color:#fff;"><img src="https://github.com/user-attachments/assets/a7c5761a-8a1c-4e77-a968-d937962c795c" alt="审查条文" /></td>
    <td style="padding: 5px;background-color:#fff;"><img src="https://github.com/user-attachments/assets/4bceb846-291e-4bf2-b820-38f0ae4a36d8" alt="Agent 智能审查" /></td>
  </tr>
</table>

> **视频演示（建筑设计场景）：** [在 B 站观看](https://www.bilibili.com/video/BV1DoFUzBEmW/?share_source=copy_web&vd_source=d91cce476d06006159a799f4db6b9171)

## 在线体验

试用地址：**[https://archspec.aizzyun.com/](https://archspec.aizzyun.com/)**

- 账号：`test@qq.com`
- 密码：`test123456`

## 技术栈

| 层级 | 技术 |
|------|-----|
| 前端 | Vue 3、TypeScript、Vite |
| 后端 | Spring Boot 3、Java 17 |
| AI Agent | Python、LangGraph、LangChain |
| 知识检索 | RAGFlow |
| 可观测性 | Langfuse（LLM 调用追踪与成本分析） |
| 数据库 | PostgreSQL |
| 部署 | Docker、Docker Compose |

## 快速开始

### 环境要求

| 组件 | 版本要求 |
|------|---------|
| Docker | >= 20.10 |
| Docker Compose | >= 2.0 |

### 一键部署

```bash
# 1. 克隆项目
git clone https://github.com/zhuzhaoyun/OpenSpec.git
cd OpenSpec

# 2. 复制并修改环境变量
cp deploy/docker/.env.example deploy/docker/.env
# 编辑 .env 文件，填入必要配置（RAGFlow、LLM API Key 等）

# 3. 启动所有服务
cd deploy/docker
docker compose up -d
```

启动完成后访问 `http://localhost` 即可使用。

### 环境变量说明

| 变量名 | 说明 | 必填 |
|--------|------|------|
| `RAGFLOW_API_KEY` | RAGFlow API 密钥 | 是 |
| `RAGFLOW_BASE_URL` | RAGFlow 服务地址 | 是 |
| `DASHSCOPE_API_KEY` | LLM API 密钥（默认通义千问） | 是 |
| `LANGFUSE_SECRET_KEY` | Langfuse 私钥（Prompt 管理） | 否 |
| `LANGFUSE_PUBLIC_KEY` | Langfuse 公钥 | 否 |
| `LANGFUSE_BASE_URL` | Langfuse 服务地址 | 否 |

完整的环境变量说明请参考 [`deploy/docker/.env.example`](deploy/docker/.env.example)。

### 本地开发

<details>
<summary>展开查看本地开发指南</summary>

#### 前端

```bash
cd apps/web
npm install
npm run dev
# 访问 http://localhost:5173
```

#### AI Agent

```bash
cd apps/agent
pip install -r requirements.txt
cp ../../deploy/docker/.env.example .env
# 编辑 .env 填入必要配置
uvicorn app:app --reload --port 5000 --host 0.0.0.0
```

#### 后端

```bash
cd apps/backend
mvn spring-boot:run
```

</details>

## 定制与合作

如需企业定制、功能扩展、部署支持或深度培训服务，欢迎联系我们。

## 参与贡献

欢迎参与贡献！你可以：

- 给项目点个 Star 表示支持
- 提交 [Issue](https://github.com/zhuzhaoyun/OpenSpec/issues) 反馈 Bug 或功能建议
- 发起 [Pull Request](https://github.com/zhuzhaoyun/OpenSpec/pulls) 贡献代码

## Star History

<a href="https://star-history.com/#zhuzhaoyun/OpenSpec&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=zhuzhaoyun/OpenSpec&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=zhuzhaoyun/OpenSpec&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=zhuzhaoyun/OpenSpec&type=Date" />
 </picture>
</a>

## 联系我们

如需了解企业版详情或商业合作，欢迎通过以下方式联系：

- 邮箱：`dlutyaol@qq.com`
- 企业微信：扫描下方二维码添加

  <img src="docs/企业微信.png" alt="企业微信" width="200" />

## License

Copyright (c) 2024-2026 OpenSpec Contributors.

Licensed under [The GNU General Public License v3.0 (GPLv3)](https://www.gnu.org/licenses/gpl-3.0.html).
