# PROJECT RECOVERY REPORT

> 这是修复前的审计快照。2026-09-20 获授权后的实施与当前验证结果见 [恢复修改记录](RECOVERY_CHANGES_2026-09-20.md)，下文历史故障不表示当前恢复分支仍存在同一故障。

审计对象：LongyuChat / C:/codeX
报告完成：2026-09-20；运行实验：2026-09-05；Git 基线复核：2026-09-20。

本报告完成项目发现、架构还原、隔离运行、产品体验、技术审计、目标设计和恢复规划。未修改业务代码，未迁移原数据库，未切换原工作区分支，未部署，未调用真实付费模型，未验证任何发现的凭据是否有效。

**阅读约定**

- CONFIRMED：由代码、Git 或本次实验直接支持；“代码存在”不等于“生产可用”。
- LIKELY：证据支持的推断，尚缺完整运行验证。
- UNCERTAIN：有疑点，现有证据不足以确定原因或影响范围。
- UNKNOWN：没有获得必要信息。
- 除特别注明外，下文代码路径和行号均属于 **257fbea**，而非当前 main。永久查阅方式是 git show 257fbea:路径；可运行的隔离源码在 C:/Users/11501/.codex/tmp/project-recovery-20260905/latest。
- 运行结论是 9 月 5 日的隔离实验结果，9 月 20 日确认两个 Git SHA 未变。没有据此宣称线上服务现在处于相同状态。
- 原始日志和脱敏证据索引见 [验证记录](recovery/2026-09-05/VERIFICATION.md)，快速接手入口见 [项目概览](PROJECT_OVERVIEW.md)。

## 1. Executive Summary

**结论：这是一个已经形成“公开个人 AI 门户 + AI 日报 + 私有多模型聊天室”的个人网站。适合局部修复后恢复开发，没有证据支持整体重写。**

最容易造成误判的是版本现场：

| 对象 | 实际状态 | 含义 |
| --- | --- | --- |
| 当前 main | 7e29b4f，2026-03-23 | 主要是聊天室，不能代表开发终点 |
| 较新本地分支 | codex/huashu-frontend-deep-optimization，257fbea，2026-05-12 | 比 main 多 45 个提交，线性后继 |
| 原 prisma/dev.db | 19 张业务表、22 条迁移记录 | 已经包含较新版本的数据结构 |
| 隔离最新版 | lint、258 个测试、build 通过 | 可安装、可编译，有可复用资产 |
| 隔离生产模式 | 建房间失败、日报部分事务失败 | 当前不应直接恢复公开部署 |

两个阻断项优先于新功能：生产 Prisma 客户端生命周期错误；Git 跟踪的 SQLite 备份中存在明文、非测试样式的凭据。前者已复现，后者的存在已确认，但凭据有效性、仓库公开性和外部访问情况未知。

日报有真实后端，不是页面原型；但公开 API 的发布状态过滤、重复发布、失败汇总和首页刷新都存在可复现缺陷。现有文档仍大量描述早期 MVP，不能直接当作最新版能力清单。

本次交付是诊断和恢复方案，不是修复完成声明。

## 2. Project Identity

根据实际入口和数据模型，项目有三个部分：

1. **个人门户**：首页、关于、项目展示，面向访客。
2. **AI 日报**：来源配置、采集、聚类、生成或规则降级、发布、归档、RSS、大事记，连接个人管理与公开内容。
3. **私有 AI 工作台**：模型与连接配置、单聊、顺序群聊、历史续聊、轮次进度和失败状态。

核心资产仍是模型调用与对话；日报是已经落地的自然扩展；门户提供统一入口。项目展示目前是静态内容，尚未形成项目管理或推荐系统。

**不是已实现的能力**：Agent 平台、知识库、RAG、MCP 工具执行器、个人 AI OS、多用户 SaaS。页面出现这些词，不构成实现证据。

存在定位漂移，但不是完全无结构：4 月以后的代码已主动转向个人门户；漂移主要体现在 README/AGENTS 仍约束聊天 MVP，而代码和导航已扩展。恢复时应先把事实、下一阶段范围、远期设想分开写清。

证据：app/page.tsx；components/app-navigation.tsx:11；components/projects-page.tsx；app/daily；server/services/daily-*；prisma/schema.prisma。

## 3. Project History Reconstruction

| 时间 / 提交 | 可确认的变化 | 对今天的影响 |
| --- | --- | --- |
| 03-10，da25b98 / d75e8a4 | 初始化及聊天 MVP | 奠定 route / service / adapter / orchestrator 分层 |
| 03-11，9afcbc8 | 登录、PWA 元数据、厂商相关能力 | 已超出原始“无登录”范围 |
| 03-23，84fdc03 → 7e29b4f | 顺序回复进度与时间线 | 当前 main 停在这里 |
| 03-23～24，6946370 → add3b80 | Stitch / Gemini 前端迭代 | 留下原型、设计交接和替代工作树 |
| 03-27，7e3e16f / 8d31489 | ProviderConnection 与模型配置流程 | 连接和模型逐步分离，仍保留兼容字段 |
| 03-27，9cfc37c / 6b47608 | 一度纳入大量辅助材料，随后清理 | 从工作树移除不代表从历史移除 |
| 03-30，a9c36b1 | 编排可靠性、快照、冷却状态 | 行为已超出最初的简单顺序循环 |
| 04-02，04619a8 / 13cf61b | 轮次、步骤、持久化事件 / SSE | 可以展示整轮执行状态 |
| 04-24，817c8d3 | 门户和日报扩展 | 产品发生实质变化 |
| 04-29～30，32bbbc0 / 8e3826f / e1e3855 | 门户层级与个人 AI 门户定位 | 导航已有新产品骨架 |
| 05-01，8517c7f | 公开门户、私有聊天访问范围 | 公开接口的权限边界变得关键 |
| 05-05，f8c6f72 / 939e4ca | 登录与门户导航协调 | 继续打磨统一体验 |
| 05-12，257fbea | 日报详情、归档、大事记、交接与迁移 | 较新分支最后提交，注明未验证迁移后的生产部署 |

CONFIRMED：git rev-list --left-right --count main...257fbea 返回 0 / 45；差异约 207 文件、增加 34,873 行、删除 4,082 行。reflog 显示 9 月 5 日从较新分支切回 main。因此“main 没有日报”不能推导出“日报没有开发”。

未执行 fetch；远程引用是本地已有记录。远端现在是否有更新、生产服务器部署哪个 SHA，均 UNKNOWN。没有发现知识库、Agent 或 MCP 执行系统曾经完整实现又被删掉的证据。

## 4. Current Architecture

这是 **Next.js 单体应用 + SQLite**，前后端同仓同部署。主要服务边界已经存在，尚不需要拆微服务。

~~~mermaid
flowchart TB
    Visitor[公开访客] --> Portal[首页 / 日报 / 项目 / 关于]
    Owner[站点所有者] --> Gate[Proxy / 登录会话 / 请求校验]
    Gate --> ChatUI[聊天室 / 模型配置]
    Gate --> AdminUI[日报管理]
    ChatUI --> ChatAPI[Chat / Model / Connection API]
    ChatAPI --> ChatService[Room / Message / Round Services]
    ChatService --> Orchestrator[顺序编排与上下文]
    AdminUI --> DailyAPI[Daily Admin API]
    DailyAPI --> Pipeline[采集 / 聚类 / 发布]
    Pipeline --> DailyAI[Daily AI Service]
    DailyAI --> Adapter[统一 ModelAdapter]
    Orchestrator --> Adapter
    Adapter --> Transport[Provider HTTP Transport]
    Transport --> Provider[OpenAI 兼容服务]
    Pipeline --> Feed[来源 HTTP 采集]
    Portal --> DailyRead[日报读取服务]
    ChatService --> DB[(Prisma / SQLite)]
    Pipeline --> DB
    DailyRead --> DB
    DB --> Events[持久化轮次事件]
    Events --> SSE[SSE 轮询输出]
    SSE --> ChatUI
~~~

这张图包含两个重要例外：HomeDashboard 直接做模型和房间聚合查询；日报来源抓取绕过了 Provider 的 URL 安全传输层。前者影响耦合与首页缓存，后者产生安全和超时控制缺口。

没有独立 Python 后端、消息队列、Redis、WebSocket、向量数据库。文件系统中的个人笔记不属于应用长期记忆。定时采集入口是脚本/API 与部署约定，不是已经验证的常驻调度服务。

## 5. Technology Stack

以下是 257fbea 锁定版本，不能理解成最新版本建议。

| 层 | 当前选择 | 评价 |
| --- | --- | --- |
| Web | Next.js 16.1.6 / React 19.2.4 / App Router | 保留，先补生产行为验证 |
| 类型 / 校验 | TypeScript 5.9.3 / Zod 4.3.6 | 已使用，但测试类型与 AI JSON 校验不完整 |
| UI | Tailwind CSS 4.2.1 / 自定义 CSS 与组件 | 无需换 UI 栈 |
| 数据 | Prisma 7.4.2 / better-sqlite3 adapter / SQLite | 个人单实例场景合适 |
| 测试 | Vitest 4.0.18 / Playwright 1.56.1 | 单元测试资产可保留，缺生产集成保障 |
| 工具 | ESLint 9.39.4 / dotenv 17.3.1 / npm lockfile | 可复现安装基础存在 |
| 运维 | Node 脚本、Shell 更新/备份脚本、nginx 示例 | 有实用积累，需恢复演练 |

隔离实验环境：Windows、Node 24.14.1、npm 11.11.0。未发现应用必需的 Python 依赖；根目录 pyproject.toml 不是后端证据。所检查的较新提交没有根级 Docker/Compose 或 GitHub Actions 流水线。

npm run check 只串联 lint 和 test；全量 TypeScript 检查没有进入该质量入口。另在隔离安装的 Next.js 16.1.6 中确认，node_modules/next/dist/lib/typescript/runTypeCheck.js:118–123 会过滤匹配 test/spec 的文件诊断。因此 build 通过与测试文件存在类型错误并不矛盾。

## 6. Module Map

| 位置 | 职责 | 边界与问题 |
| --- | --- | --- |
| app / app/api | 页面与 API 入口 | 多数 route 有参数校验、委托服务；公开日报状态过滤缺失 |
| components | 门户、聊天、模型、日报管理 UI | 部分客户端组件体积过大 |
| lib/client/longyuchat-client.ts | 同源请求及客户端共享逻辑 | 1,248 行，职责偏多 |
| lib/provider-catalog.ts | 厂商能力、默认值、连接模板 | 已有统一目录；枚举不等于适配实现 |
| lib/runtime.ts / lib/app-auth.ts / proxy.ts | 配置、会话、访问范围 | 私有单所有者模型，无用户体系 |
| server/services/*room* / message / conversation-round | 房间、持久化、冷却、轮次 | 内存锁与进程生命周期绑定 |
| server/orchestrators | 排序、上下文拼装、逐模型回复 | 已经与 UI 分离 |
| server/adapters / server/http/provider-request.ts | 厂商协议和请求传输 | 单一 OpenAI 兼容实现，未支持 token 流 |
| server/services/daily-* | 日报来源、兴趣、聚类、运行和发布 | 主流程 1,027 行；失败语义与发布状态需修正 |
| server/security / observability / presenters | 密钥加密、日志、响应脱敏 | 有基础防护，历史数据和日志边界还需补齐 |
| prisma | 19 个业务模型、22 条迁移 | 原库已是较新结构 |
| scripts / docs | 启动、运维、日报 CLI、交接 | Windows 启动包装脚本失败，文档版本混杂 |

14 个页面路由：

| 领域 | 路由 |
| --- | --- |
| 门户 | /、/about、/projects |
| 身份 | /login |
| 聊天 | /models、/rooms、/rooms/new、/rooms/[id]、/rooms/[id]/edit |
| 日报 | /daily、/daily/[slug]、/daily/archive、/daily/events |
| 管理 | /admin/daily |

35 个 API route 文件分为：auth 3、daily 13、models 4、provider catalog / connections / discovery 6、rooms 6、dev mock 2、health 1。日报 13 个中包括来源、兴趣、运行、种子入口和公开内容接口。完整路由列表见保存的 build-latest.log。没有独立注册、用户 Dashboard、Prompt Library 或全局 Settings 页面。

## 7. Data Flow

### 聊天发送

~~~mermaid
sequenceDiagram
    participant U as RoomChat UI
    participant R as messages API
    participant S as RoomMessage Service
    participant D as SQLite
    participant O as Orchestrator
    participant A as ModelAdapter
    U->>R: POST 用户内容
    R->>S: 校验后的 roomId / content
    S->>D: 保存用户消息、创建轮次与步骤
    S->>O: 可执行模型、历史、回调
    loop 按 sortOrder
        O->>A: 当前模型上下文
        A-->>O: 完整回复或错误
        O->>S: 回复 / 失败回调
        S->>D: 消息、步骤、事件、冷却状态
        Note over O: 成功回复加入后续模型上下文
    end
    S-->>R: completed 或 partial
    R-->>U: 结果 / 207 部分成功
    U->>R: 独立 EventSource 请求 events API
    R->>D: 轮询持久化事件
    R-->>U: SSE snapshot / 进度
~~~

入口：components/room-chat-page.tsx → lib/client/longyuchat-client.ts → app/api/rooms/[id]/messages/route.ts → room-message-service.ts:220 → message-service.ts:117 → conversation-orchestrator.ts:343 → openai-compatible-adapter.ts。

保存用户消息先于模型请求；模型成功后保存回复并扩展本轮历史。消息 sequence 由服务与事务维护；speaker 快照防止模型重命名破坏历史归属。

**契约冲突**：最新版 orchestrator 在模型请求失败后执行 continue（:389），继续后续模型；用户提供的现行 AGENTS 要求失败即停止。报告记录现状，未擅自改动。恢复实现应遵守现行停止策略，除非所有者明确选择保留最新版继续策略，并同步规范和测试。

SSE 是数据库事件流，约每 700 ms 检查一次（events/route.ts:156）；不是模型 token 流。断开事件订阅不等于取消已经发出的模型请求。

### 日报采集与发布

来源配置 → daily-fetch-service 抓取 → DailySourceItem → 聚类与来源关联 → DailyStoryCluster → 候选筛选 → daily-ai-service 或规则降级 → DailyIssue / Item / Source → 公开详情、归档、RSS。

DailyRun / DailyRunStep 保存任务结果。9 月 5 日开发模式用三条合成来源走通了规则降级发布与 RSS；没有据此验证真实新闻质量、LLM 编辑能力或定时任务无人值守运行。

## 8. Feature Inventory

分类：A 已实现且本次证据支持使用；B 基本实现但有明显问题；C 部分实现；D 只有展示 UI；E 有后端能力但缺完整操作 UI；F 现有代码在验证场景失效；G 已废弃；H 仅规划或未实现；I 状态未知。A 项仍受其明确的验证范围限制。

下表路径均属于 257fbea；同组能力合并，避免把每个按钮当成独立产品。

| 功能 | 类别 / 证据等级 | 相关文件与依赖 | 问题 / 保留判断 |
| --- | --- | --- | --- |
| 关于页与门户导航 | A / CONFIRMED | app/about、app-navigation；页面浏览 | 静态内容可用；KEEP |
| 登录、退出、会话 | B / CONFIRMED | lib/app-auth、auth routes、proxy | 登录与未授权拦截通过；撤销依赖内存；KEEP 并补边界 |
| 公开门户 / 私有聊天访问范围 | B / CONFIRMED | proxy、lib/server-access | 日报公开接口绕过发布约束；REFACTOR |
| 首页内容汇总 | B / CONFIRMED | HomeDashboard、daily-issue-service、Prisma | 生产构建后内容不刷新；REFACTOR |
| 模型配置创建 / 编辑 / 删除 | B / CONFIRMED | models-page、model-config-service | 合成模型创建成功且不返回 key；类型和凭据迁移有缺口；KEEP |
| Provider Connection 管理 | B / CONFIRMED | provider-connection-service、models-page | 已有数据/UI/测试，配置兼容字段重复；KEEP |
| 模型发现与连接测试 | B / CONFIRMED | discovery-service、adapter、provider-request | mock 测试通过；真实厂商未验，UI smoke 被本地 URL 策略阻挡；KEEP |
| 厂商 / API 模板 | A / CONFIRMED | provider-catalog、目录接口 | 本地目录可用，不代表所有厂商真连接通过；KEEP |
| 创建单聊与群聊 | B / CONFIRMED | chat-room-service:349、schema | 开发 201，生产 500；修复生命周期后保留 |
| 房间编辑、模型重排 | B / CONFIRMED | configuration/order routes、chat-room-service | 事务路径受生产问题影响；KEEP |
| 单模型聊天闭环 | B / CONFIRMED | room-message-service、adapter | mock 可测；开发失败消息保存已验，真实成功回复端到端未验；KEEP |
| 多模型顺序回复 | B / CONFIRMED | conversation-orchestrator、测试 | 顺序/上下文已有实现；失败策略与规范冲突；KEEP |
| 后续模型读取本轮前序回复 | B / CONFIRMED | orchestrator:343 后的 history.push、测试 | 用带身份的文本上下文，无共享思维或 Agent 协作；KEEP |
| 历史保存和续聊 | B / CONFIRMED | message-service、room API、schema | 失败后的用户消息重载通过；全历史无分页；KEEP |
| 轮次、步骤、进度事件 | B / CONFIRMED | conversation-round-service、events route | SSE 初始快照通过；进程崩溃后的轮次恢复不完整；KEEP |
| 模型错误冷却、跳过、恢复状态 | B / CONFIRMED | chat-room-service、room-message-service | UI 可见失败冷却；生产事务与语义需统一；KEEP |
| Provider 超时和有限重试 | B / CONFIRMED | adapter、provider-request | 有恢复请求；不是失败步骤可恢复执行；KEEP |
| 房间列表搜索 | B / CONFIRMED | rooms-page / client 过滤 | 本地列表能力；不是全站全文检索；KEEP |
| 日报来源、兴趣配置 | B / CONFIRMED | daily-admin、source/interest services | 有 API/UI；任意 URL 和技术化配置暴露；REFACTOR |
| 日报抓取与聚类 | B / CONFIRMED | daily-fetch / pipeline / cluster | 开发合成来源走通；生产事务失败，扫描可假成功；REFACTOR |
| 日报 AI 编辑生成 | C / CONFIRMED | daily-ai-service、pipeline | 接口和逻辑存在；LLM JSON 结构缺验证，真实质量 UNKNOWN；分阶段验证 |
| 日报规则降级生成 | B / CONFIRMED | pipeline | 三条合成内容发布成功；发布状态不安全；KEEP |
| 日报发布 | B / CONFIRMED | pipeline:738、issue-service | 重复发布可撤下既有成功结果；REFACTOR |
| 日报详情与归档 | B / CONFIRMED | app/daily、issue-service | 页面过滤 PUBLISHED；公开 API 未同步；KEEP |
| 日报 RSS | A / CONFIRMED | daily/rss、buildDailyRssXml | 合成已发布内容输出通过；KEEP |
| 日报大事记 | B / CONFIRMED | major-event-service、daily/events | 有持久化/种子，也有 13 条回退内容；实时维护未验；KEEP |
| 日报运行记录 | B / CONFIRMED | DailyRun / Step、daily-admin | 整体 SUCCESS 可遮蔽失败步骤；REFACTOR |
| 日报条目文本编辑服务 | E / CONFIRMED | issue-service:425 | 有 helper，未形成完整人工编辑发布工作台；需求确认后补 UI |
| 日报定时扫描 / 发布 | I / UNKNOWN | scripts/daily-*.mjs、运维文档 | 代码入口存在，线上 cron 安装及稳定性未验 |
| 项目展示 / 推荐 | D / CONFIRMED | components/projects-page.tsx | 静态栏目和说明，不是推荐流或项目 CRUD；保留简洁展示 |
| PWA 元数据 / 图标 | C / CONFIRMED | app/manifest.ts、图标 | 安装外壳不等于离线、推送或原生 App；KEEP 现有范围 |
| 健康检查与结构化日志 | B / CONFIRMED | health route、server-logger | 有基础，未见统一可观测闭环；KEEP |
| SQLite 备份脚本 | B / CONFIRMED | scripts/sqlite-backup.mjs | 在线拷贝一致性、恢复演练待补；REFACTOR |
| Windows dev:local | F / CONFIRMED | start-dev-local.mjs:54 | Node 24.14.1 上 spawn EINVAL；局部修复 |
| UI smoke 完整流程 | F / CONFIRMED | scripts/ui-smoke.mjs | loopback mock 与 SSRF 限制冲突；修测试边界 |
| 全量 TypeScript 检查 | F / CONFIRMED | 测试 fixture / declarations | 119 个诊断、15 个测试文件；修类型契约 |
| 原本地测试启动 UI | G / CONFIRMED | 历史 components/local-test-launcher.tsx | 71eaeeb 删除；无需无条件恢复 |
| 原 chat-lab client 命名 | G / CONFIRMED | 历史 lib/client/chat-lab-client.ts | 后续更名 longyuchat-client，能力并非凭空丢失 |
| 原型里的 Prompt Library | H / CONFIRMED | Stitch 等参考材料 | 应用无相应 route/service/schema；暂缓 |
| 指定本轮发言 / @模型 / 角色分工 | H / CONFIRMED | 无对应执行接口 | 排序和选模型不等于该能力；暂缓 |
| 并行群聊 / 自动多轮 / 总结者 | H / CONFIRMED | 无运行实现 | 不因未来愿景立即开发 |
| token 流 / 停止生成 | H / CONFIRMED | ModelAdapter 无流/取消契约 | 当前只有事件进度；按使用痛点决定 |
| 消息编辑 / 分支 / 失败步骤重试 | H / CONFIRMED | 无完整 API / schema 链路 | 重发新消息不是恢复旧步骤 |
| RAG / Embedding / 向量库 / 长期记忆 | H / CONFIRMED | 无运行模块或数据模型 | 暂缓 |
| Agent / Tool Calling / MCP runtime | H / CONFIRMED | 无执行器、工具权限或适配契约 | 暂缓；项目说明文案不是后端 |
| 上传 / 文件解析 / 语音 | H / CONFIRMED | 无应用闭环 | 不增加攻击面或依赖 |
| 多用户 / 注册 / 商业权限 | H / CONFIRMED | 无 User/Workspace 表 | 个人所有者模式足够 |
| 真实厂商成功率 / 线上备份恢复 | I / UNKNOWN | 需要独立线上或凭据验证 | 不能从单元测试推导 |

## 9. AI System Audit

### Provider 抽象与实际支持

已有 ModelAdapter（server/adapters/model-adapter.ts:14）与统一工厂，不需要从零创建“AI Core”。目前唯一真实协议实现是 OpenAiCompatibleAdapter，围绕 chat/completions。厂商差异主要来自 catalog、连接配置和请求参数。

| 厂商 / 接口 | 代码层状态 | 本次运行结论 |
| --- | --- | --- |
| GPT / OpenAI | OpenAI 兼容适配 | mock 验证；真实账号未调用 |
| Claude | catalog 存在，但 adapterKind 为 UNSUPPORTED（:173） | 不支持原生 Anthropic 协议；不能宣称已接入 |
| Gemini | Google 的 OpenAI 兼容入口 | 非原生 Gemini SDK；真实连接未验 |
| Grok | OpenAI 兼容配置 | 模板存在；真实连接未验 |
| DeepSeek | OpenAI 兼容配置 | 模板存在；真实连接未验 |
| 豆包 | OpenAI 兼容配置 | endpoint/model 配置仍取决于用户账户 |
| Kimi | Moonshot 模板（provider-catalog.ts:273） | 属于通用兼容类型，没有独立原生适配器 |
| 其他兼容服务 | 自定义地址、key、模型名 | 可扩展；仍受 URL 安全和协议兼容性约束 |

群聊不是 Agent 群：顺序固定，后一个模型收到前面已保存的文本回复与说话者信息；没有角色规划器、工具调用、自动辩论或多轮自治。

### 上下文、Prompt 与 token

- buildConversationMessagesForModel（orchestrator:325）负责为当前模型构建上下文；历史裁剪默认窗口约 8 条、估算预算约 2,400 token，由 runtime 配置。
- 当轮消息保留及较大单条消息的边界使该预算不是严格模型上下文上限。没有按真实模型能力表进行严格 token 验证，也没有自动摘要记忆。
- 系统提示、参与者名单、短输入稳定指令、长度指令主要位于 orchestrator；回复恢复/长度处理位于 adapter；日报编辑 Prompt 位于 pipeline。属于可解释的业务分散，但应加版本/职责标记。
- 提示词是字符串与配置，不是可管理的 Prompt Library。模型回复文本不应被直接解释成权限或工具命令。
- 已有请求耗时、排队耗时、尝试次数等字段；没有完整持久化 token 账本或成本页面。响应中的 usage 处理不能等同于产品级用量统计。

### 主要缺口

ModelAdapter 返回完整内容，没有 AsyncIterable 事件契约、AbortSignal、结构化 tool call 或能力声明。新增原生 Claude 等协议时，可添加 adapter 与 catalog 能力并做契约测试；不能保证只改一个文件，因为表单校验、错误映射和响应语义也需登记。

日报是第二个 AI 消费者，证明分离 AI 调用与 Chat UI 是真实需要。优先整理共享请求、错误、取消、模型能力和结构化响应校验；不提前搭空的 AgentRuntime、ToolRuntime 和插件市场。

## 10. Database Audit

19 张业务表可以分为两组，另有 _prisma_migrations：

- 聊天 8 张：ModelConfig、ProviderConnection、ChatRoom、ChatRoomModel、Message、ConversationRound、ConversationRoundStep、ConversationRoundEvent。
- 日报 11 张：DailyInterestProfile、DailySource、DailySourceItem、DailyStoryCluster、DailyStoryClusterItem、DailyIssue、DailyIssueItem、DailyIssueItemSource、DailyMajorEvent、DailyRun、DailyRunStep。

~~~mermaid
erDiagram
    ProviderConnection ||--o{ ModelConfig : configures
    ChatRoom ||--o{ ChatRoomModel : binds
    ModelConfig ||--o{ ChatRoomModel : participates
    ChatRoom ||--o{ Message : stores
    ChatRoom ||--o{ ConversationRound : runs
    ConversationRound ||--o{ ConversationRoundStep : contains
    ConversationRound ||--o{ ConversationRoundEvent : records
    DailySource ||--o{ DailySourceItem : provides
    DailyStoryCluster ||--o{ DailyStoryClusterItem : groups
    DailySourceItem ||--o{ DailyStoryClusterItem : belongs
    DailyIssue ||--o{ DailyIssueItem : publishes
    DailyStoryCluster ||--o{ DailyIssueItem : supplies
    DailyIssueItem ||--o{ DailyIssueItemSource : cites
    DailyRun ||--o{ DailyRunStep : records
~~~

图为核心关系节选，未穷举可空关系与删除策略；以 schema 为准。不表示存在 User、Workspace、Agent 或 Knowledge 隐藏实体。

**值得保留的约束**：roomId/modelId 唯一，roomId/sortOrder 唯一，roomId/sequence 唯一；轮次步骤也有顺序与参与者唯一约束。单聊恰好 1 模型、群聊至少 2 模型由 service 验证，不是数据库 CHECK。speaker 快照保留历史语义；消息序号通过事务分配并有重试。

**原库只读检查**：integrity_check = ok，外键违规 0，22 条迁移名称与较新源码对应。清洁迁移库与原库在列属性、外键、唯一约束和索引上的语义比较未发现差异；忽略了列与索引枚举顺序。此结果不是所有业务数据都正确的证明。

两个迁移 checksum 原始值不同：

1. 20260326120000_add_model_avatar_color：行尾 LF / CRLF 可解释。
2. 20260422165000_add_daily_interest_profiles：无法用行尾差异解释，UNCERTAIN。

不要 reset 原库，也不要仅为消除警告修改迁移记录。先追踪第二项历史、在安全备份上复演。最初的机械比较包含顺序差异，不能把它误写为“五张表结构漂移”；最终 schema-drift-details.json 为空对象。

另有历史兼容债务：ModelConfig 与 ProviderConnection 均存部分调用配置，迁移过程中需要明确主来源；原库 12 个模型中 10 个明文字段、2 个加密字段，连接记录 1 个加密字段。生产启动检查会拒绝明文密钥，不能仅设置加密环境变量就认为旧数据已转换。

## 11. Frontend Audit

App Router 布局、门户 server components、聊天和配置 client components 的分工基本成立。同源 API 请求集中在 client helper，状态主要用 React hooks，没有复杂全局状态库。

主要维护热点：

| 文件 | 约行数 | 建议的具体拆分 |
| --- | --- | --- |
| app/globals.css | 1,482 | 保留变量体系，按门户/聊天/管理样式整理 |
| components/room-chat-page.tsx | 1,429 | 提取事件订阅、发送状态、轮次时间线；保留外部行为 |
| lib/client/longyuchat-client.ts | 1,248 | 请求基础与领域 API 分离 |
| components/models-page.tsx | 1,072 | 连接管理与模型编辑状态分离 |
| components/models-page/model-builder-panel.tsx | 816 | 在真实编辑场景下拆字段组和验证反馈 |
| components/daily-admin-page.tsx | 808 | 来源、兴趣、运行结果面板分离 |

已有 room-chat helpers/derived/shared 和 models 子面板，说明无需重新搭组件体系。未发现必须换状态管理库的证据。静态 import 图未发现循环不意味着没有状态耦合；消息、轮次和房间快照多路同步仍需行为测试。

门户与聊天室使用不同重点色，但共享视觉语言，未见值得立即整体重绘的理由。生产首页缓存是正确性问题，应优先于样式调整。

## 12. Backend Audit

总体是 route → service → adapter / orchestrator / DB。存在参数校验、标准 API 错误、requestId、Presenter 密钥脱敏、频率限制等工程基础。

最严重的问题位于 lib/prisma.ts:17–43：生产环境每次 Proxy 属性访问都创建新 PrismaClient，并以 Proxy 为方法 receiver。交互式事务的内部调用可能落到不同客户端；本次通过真实 SQLite 复现 Transaction not found。开发环境缓存 globalThis，掩盖了问题。

受影响路径包括 createChatRoom（chat-room-service.ts:354）、消息分配事务（message-service.ts:42、:75）、聚类关系替换（daily-cluster-service.ts:203）、日报条目替换（daily-issue-service.ts:347）。不是“Prisma 天生不能使用 SQLite”，也不是简单增加事务超时能够解决。

其他边界：

- 房间互斥、限流、会话撤销等部分状态存内存；当前单实例可接受，但重启和多实例语义有限。
- 已有持久化轮次并不自动提供崩溃恢复；进程终止后的 RUNNING 状态需要恢复策略。
- 日报任务主要在请求生命周期执行；没有可确认的耐久后台队列和任务租约。
- SSE 有持久化事件基础，但轮询频率与连接数会增加 SQLite 读负载；当前无需先引入消息中间件。
- 日报抓取没有与 Provider 相同的超时、目标限制和响应大小约束。
- generateAiDailyJson 使用 JSON.parse 后类型断言（daily-ai-service.ts:132），缺少运行时 schema；Promise.race 超时不保证底层模型请求取消。

## 13. UX Audit

已实际浏览首页、登录、房间列表、新建房间、模型页、聊天/历史、日报空态与详情、归档、大事记、项目、关于和日报管理；测试内容均为合成数据。

| 用户可见现象 | 实际含义 | 处理方向 |
| --- | --- | --- |
| 首页看起来没有日报 | 生产静态页面可能仍是构建时数据 | 先修缓存策略，不能让用户重复生成“找回内容” |
| 日报扫描显示 SUCCESS | 来源步骤可能全部 FAILED | 展示成功/部分失败/失败和具体原因 |
| 大事记有内容 | 可来自 13 条回退条目 | 标清编辑来源与更新时间，避免误解为在线抓取 |
| 项目页有模块卡片 | 尚无项目推荐/管理闭环 | 明确静态展示用途，减少未来能力承诺 |
| 模型测试报英文 URL 错误 | 本地测试目标被安全策略拒绝 | 使用可理解的错误与字段定位，不关闭防护 |
| 聊天有“进度” | 展示整条回复状态，不是逐字生成 | 文案与实际能力保持一致 |
| 日报管理入口不显眼 | 全局导航没有直接管理入口 | 登录后提供所有者管理入口 |
| 配置面板密集、configJson 技术化 | 所有者也需理解内部格式 | 优先明确必要字段、默认值和结果解释 |

未发现所访问页面普遍空白或整个导航崩坏；这不代表所有路径、按钮和异常状态均已验收。手机 390×844 的日报页面检查未见横向溢出；导航空间紧张，不能据此宣布全站移动端通过。键盘导航、读屏、焦点管理仍未完成系统验收，部分图标按钮/字段标签需要专项检查。

恢复时的首条用户闭环应该是：登录 → 配置一条连接 → 测试 → 建单聊 → 发消息 → 刷新后续聊。第二条是：采集 → 查看明确结果 → 发布 → 匿名页面、归档、RSS 一致可见。

## 14. Security Audit

优先级表示恢复顺序，不表示已发生入侵。

| 项目 | 等级 / 证据 | 实际风险和边界 | 最小措施 |
| --- | --- | --- | --- |
| Git 中明文凭据备份 | P0 / CONFIRMED 存在，有效性 UNKNOWN | var/backups/sqlite/2026-03-10-2315-dev.db 被跟踪；8 个明文字段，至少 2 个非测试凭据形态；未展示或调用这些值 | 核对并撤销可能泄露的凭据，再计划移出 Git 与必要历史清理 |
| 原库明文模型 key | P1 / CONFIRMED | 10 个旧模型字段明文，生产启动检查拒绝 | 安全备份后执行已有加密迁移策略并复验；保留回滚能力 |
| 未发布日报公开读取 | P1 / CONFIRMED | 匿名 GET /api/daily/issues/[slug] 返回 SKIPPED 的 3 条内容；list route 还接受 DRAFT/SKIPPED 参数，代码未限公开状态 | 公开查询强制 PUBLISHED；私有查询单独授权 |
| 日报来源 SSRF | P1 / CONFIRMED loopback 可达 | 已登录管理员可配置 127.0.0.1 来源并抓取；不是匿名任意请求漏洞 | 共享安全 URL/重定向校验、超时、大小限制；明确允许来源 |
| 依赖安全公告 | P1 / CONFIRMED 审计快照 | 09-05 npm audit 报告 29 个受影响包条目，2 low/6 moderate/20 high/1 critical；不等于 29 个已可利用漏洞 | 刷新公告、按可达路径评估、定向升级及回归 |
| 会话撤销内存化 | P2 / CONFIRMED | 签名、过期、jti 已有；重启/多进程不能持久共享撤销状态 | 单实例先明确失效策略，确需时持久化 |
| 日志脱敏不覆盖任意 key 名值组合 | P2 / LIKELY | 现有规则按字符串模式脱敏，无法保证任意格式 API key 都覆盖；未复现真实泄露 | 按字段名与允许字段集脱敏，增加不同格式 fixture |
| Provider DNS 校验与连接分离 | P2 / LIKELY | 预解析安全检查后由请求再解析，未证明抗 DNS rebinding | 评估固定解析结果的传输方式；未进行攻击验证 |
| AI 内容与来源链接 | P2 / LIKELY | 不可信网页可影响日报选择/文案；结构化输出缺 schema，来源链接需要协议限制 | 来源数据与指令分离、结构校验、明确发布审核 |

已验证的防护：匿名聊天室 API 返回 401；匿名日报管理页跳转登录；跨站 mutation 返回 403；模型创建响应不含假密钥；Provider 路径拒绝 loopback。现有 .env / .env.local 只读取变量名，未输出值；未在检查范围内发现其被 Git 跟踪。不能因此忽略 SQLite 备份中的秘密。

未发现可确认的用户输入拼接 SQL 注入链路；health 的常量 SELECT 1 不构成注入证据。所查 UI 主要使用 React 文本渲染，没有据此证明可利用 XSS；仍应约束外部链接与 AI 输出。没有上传、MCP Tool、任意工具执行链路，因此不能虚构这些功能的当前漏洞。

依赖公告的条件需要单独解释：[Next.js 官方公告](https://github.com/vercel/next.js/security/advisories/GHSA-26hh-7cqf-hhc6)涉及特定中间件/构建条件，未在本项目复现绕过；[Vitest 官方公告](https://github.com/vitest-dev/vitest/security/advisories/GHSA-5xrq-8626-4rwp)要求相应 UI/API/browser 暴露条件，普通 vitest run 通过或安装该版本不证明已经受攻击。不要执行 npm audit fix --force；快照中的自动建议包含 Prisma 主版本回退。

备份还存在可用性风险：sqlite-backup.mjs 顺序复制数据库、WAL、SHM，不保证正在写入时得到同一时点的一致快照。恢复路线应使用并验证 SQLite 支持的一致性备份方式，参考 [SQLite Online Backup](https://www.sqlite.org/backup.html)，并实际恢复演练。备份清理也应限于本脚本创建的文件。

## 15. Technical Debt

| 债务 | 具体证据 | 最小修正方向 |
| --- | --- | --- |
| 文档与运行契约脱节 | README/AGENTS 的 MVP 范围、失败即停；实际已有登录/日报且失败继续 | 一次确认范围及失败语义，更新同一事实来源 |
| 生产与开发行为不同 | Prisma 每次访问建客户端 | 改客户端生命周期和绑定方式，增加真实 SQLite 生产回归 |
| 测试契约陈旧 | 15 个测试文件 119 个类型诊断 | 更新最少必要 fixture，不用 any 掩盖 |
| 日报流程过长 | pipeline 1,027 行；抓取/聚类/编辑/发布混在流程中 | 先加状态回归，再按阶段提取 |
| UI 与客户端职责过多 | 聊天/模型/client helper 千行级 | 依据状态生命周期拆分，不按任意行数重写 |
| 配置兼容层重复 | ProviderConnection + ModelConfig 调用字段 | 明确迁移期间读写主来源，再逐步删重复 |
| Prompt / 能力标识分散 | orchestrator / adapter / pipeline / catalog | 归属清楚、版本可追踪；不建设通用 Prompt 平台 |
| 发布缺少保护状态机 | PUBLISHED 可被重复操作变成 SKIPPED | 幂等发布与原子替换，失败不覆盖成功版本 |
| 全历史读取 | 历史加载与 UI 状态规模增长 | 有真实数据量后做分页/游标，先保续聊顺序 |
| 内存状态语义隐含 | 锁、撤销、限流 | 文档明确单实例，补重启行为 |

静态 alias/相对 import 图覆盖 123 个 TS/TSX 源文件，未发现循环；该检查不包括动态加载与运行时资源依赖。没有证据支持“到处 any”“全是死代码”之类描述。也没有必要仅为架构整齐引入 Redux、Redis、队列、微服务或第二语言。

## 16. Dead / Legacy Code

| 对象 | 判定 | 建议 |
| --- | --- | --- |
| main 上较旧 chat-lab 名称 | 历史基线，非整套废弃产品 | 用 Git 保留，不重复开发最新版已有能力 |
| local-test-launcher | 已删除的开发辅助 UI | 不恢复，除非有真实测试需求 |
| .worktrees / .claude 工作树 | 替代开发现场 | 先核对分支与未提交内容，禁止一键清理 |
| _stitch_export / stitch_handoff / stitch_new_project / 前端素材 | 设计原型与参考资产 | 有用内容归档；原型不计入已实现功能 |
| backup_snapshots | 历史前端备份 | 确认唯一内容后才归档或移除 |
| vendor/TrendRadar | 外部参考材料，未见运行 import | 不作为本应用模块；是否保留待确认 |
| project-auditor / .agents / 工具状态目录 | 开发辅助 | 与产品源码分开理解，不擅自删除 |
| SOUL.md / USER.md / memory | 私人/代理上下文材料 | 不视为产品 Memory；未读取其私密正文 |
| Git 跟踪的 .vs/slnx.sqlite 与 SQLite 备份 | 不应作为源代码资产分发 | 先保护数据，再从跟踪范围移出；历史处理另行决定 |
| ai-daily/README.md 的“尚无代码”描述 | 已过时 | 下一实施阶段修正文档事实 |

“没有 import”不足以证明运维脚本或原型无价值。当前没有提出删除任何原始工作树、数据库、日志或用户文件的操作。

## 17. Current Broken Areas

### 验证结果

| 检查 | 2026-09-05 结果 | 能证明什么 |
| --- | --- | --- |
| npm ci --no-fund | 成功，511 packages | 隔离副本可安装 |
| npm run lint | 通过 | 当时清洁源码满足 ESLint |
| npm test | 38 文件 / 258 测试通过 | 已有单元/mock 契约通过 |
| npm run build | 通过 | 可生成生产构建；不等于运行闭环正常 |
| npx tsc --noEmit --incremental false | 失败，119 诊断 / 15 测试文件 | 测试类型契约与声明需要修复；捕获输出无非测试诊断 |
| 空路径 SQLite migrate deploy | Schema engine error | Windows 当前环境新文件初始化路径失败 |
| 预创建空 SQLite 文件后 migrate deploy | 22 条全部通过 | 不能断言迁移 SQL 已损坏 |
| npm run dev:local | spawn EINVAL | Windows Node/npm.cmd 启动包装问题 |
| 直接 Next dev / start | 可启动 | 核心框架可运行，无需先重写启动体系 |
| npm run test:ui:smoke | 等待连接验证超时 | mock loopback 被安全策略拒绝 |
| 生产 Prisma 专项 probe | 2 个“故障存在”断言通过 | 生产交互式事务失败、开发同操作通过；不是修复后通过 |
| 原数据库只读完整性检查 | ok、0 外键违规 | 结构基本完整；不代表凭据或迁移历史无风险 |

### 按可复现问题处理

1. **P0：生产交互式事务失效。** 同一合成配置，生产建房间 500、开发 201；真实 SQLite probe 验证客户端身份随访问变化。先修 lib/prisma.ts 生命周期，不先动 ORM 或数据库。
2. **P1：公开日报 API 越过发布状态。** 页面在 app/daily/[slug]/page.tsx:46 检查 PUBLISHED，但详情 API 只检查记录存在（:13）；列表 API 允许任意状态参数。匿名已读到 SKIPPED 内容。
3. **P1：采集失败假成功。** daily-pipeline-service.ts:246–391 捕获单来源失败后仍 finishDailyRunSuccess；来源全 503，run SUCCESS、step FAILED。
4. **P1：重复发布撤下成功内容。** pipeline:815–842 候选不足时复用已有 issue 并标 SKIPPED。合成测试先发布 3 条，再使候选不满足，已有日报被撤下且仍留 3 条数据库内容。
5. **P1：首页生产缓存陈旧。** build 报告根路由为静态；构建后写入合成 PUBLISHED 日报，公开 API 返回新标题，首页仍说没有日报。app/page.tsx 没有相应动态/失效策略。
6. **P1：日报抓取传输缺边界。** 已登录来源配置能访问 loopback；fetch 无统一超时/大小约束。修安全传输不会要求拆服务。
7. **P1：测试与类型保障不完整。** 当前 check 不能拦住生产 DB 故障和测试类型错误；日报核心发布/抓取缺相应回归，现有日报测试集中在少数 helper。
8. **P2：Windows 启动及 smoke 场景。** 属于脚本平台兼容和测试注入问题；不要删除 SSRF 校验来“让测试变绿”。

测试覆盖底线逐项核对：mock 连接、单聊保存、群聊排序、前序上下文、失败部分成功、历史重载均有代码或单元覆盖；失败部分成功的“后续是否继续”与现行规范不一致。真实厂商成功返回 → 持久化 → 浏览器显示的完整端到端闭环尚未完成，不能称作上线验收通过。

## 18. Current Development Stop Point

CONFIRMED：最近提交重心是日报详情/归档/大事记、门户文案和前端交接；257fbea 明确记录未测试迁移后的生产部署。技术交接文档还承认 pipeline/fetch/admin/cron 的测试缺口。

LIKELY 的工作停止点，以主观置信分配表达，不是统计概率：

- 约 80%：已做出日报基本链路，准备交给编辑/设计继续打磨，再做生产验证。
- 约 15%：功能已在某个环境试跑，但部署、迁移或交接未闭环。
- 约 5%：另有本地/远程未纳入当前证据的后续工作。

当前 next-env.d.ts 只有 Next 自动生成类型入口从 .next/types 改到 .next/dev/types 的差异，不是大功能开发到一半的证据。目录里有许多日志、截图和工作树，可能说明反复前端尝试，但不能据此还原未记录的产品决策。

不能把生产故障直接断言为当初停工原因；没有沟通或部署日志证明因果。

## 19. KEEP / REFACTOR / REWRITE / REMOVE

| 分类 | 模块 | 理由 |
| --- | --- | --- |
| KEEP | Next.js / React / SQLite / Prisma 技术组合 | 可运行、有测试、有实际需求匹配 |
| KEEP | route/service/adapter/orchestrator 分层 | AI 调用已供聊天和日报复用 |
| KEEP | 房间/模型关系、消息序号、speaker 快照 | 对历史一致性有价值 |
| KEEP | 轮次、步骤、事件模型 | 可以承接进度、重试和恢复改进 |
| KEEP | 日报来源—聚类—期刊—来源引用模型 | 比重新造内容系统成本低 |
| KEEP | 登录、加密、请求 ID、错误分类基础 | 补边界即可，不需引入多用户系统 |
| REFACTOR | Prisma 初始化、日报发布和采集状态 | 正确性问题明确，可局部修复 |
| REFACTOR | 日报/Provider 传输公共安全部分 | 防止不同调用路径出现不一致防护 |
| REFACTOR | 聊天组件、模型组件、client helper | 按状态/领域提取，保留行为 |
| REFACTOR | 配置兼容层、类型 fixture、运维脚本 | 降低日常恢复和修改成本 |
| REWRITE | 当前无整模块证据支持 | 先修复并衡量，再决定；不设重写 KPI |
| REMOVE | 跟踪范围内的敏感备份、IDE 运行产物 | 移出 Git；不等同于删除唯一原始数据 |
| REMOVE | 被确认过时的文档断言与重复原型副本 | 先对照历史和唯一内容，分步执行 |
| INVESTIGATE | 第二个迁移 checksum、远端最新状态、线上部署/cron、凭据有效性 | 现有证据无法定论 |

## 20. Product Positioning

建议定位：**一个由本人维护的个人 AI 门户，公开精选内容，私下使用多模型工作台。**

核心是“持续使用并产出内容”，而不是提供最多入口。聊天解决个人思考和多模型对照；日报把信息筛选转化为公开内容；首页与项目页提供个人背景和成果。

- 核心保留：连接/模型配置、可靠聊天、历史、可靠日报发布、门户。
- 自然扩展：少量个人项目与文章内容；有真实重复操作后才加小工具。
- 可作为模块接入：特定工作流、一个明确用途的知识检索、有限工具调用。
- 暂缓：通用 Agent 平台、Prompt 市场、全功能知识库、项目管理套件、插件生态。
- 当前不适合加入：多用户商业权限、计费、团队协作、原生 App、多租户基础设施。

公开门户与私有工作区共享代码和 AI 能力，但默认不共享内容可见性。一个用户也需要权限边界，不需要一整套组织/角色系统。

## 21. Proposed Information Architecture

这是建议，未改变现有导航或已批准范围。

| 一级入口 | 二级内容 | 职责 / 可见性 |
| --- | --- | --- |
| 首页 | 最新已发布日报、真实项目、个人介绍摘要 | 公开，只呈现可公开数据 |
| AI 日报 | 最新一期、归档、大事记、RSS | 公开阅读 |
| AI 工作台 | 房间、创建对话、模型与连接 | 登录后使用；访客入口进入登录 |
| 项目 | 人工维护的项目介绍 | 公开；先保持静态，不造管理平台 |
| 关于 | 个人介绍、站点说明 | 公开 |
| 所有者菜单 | 日报管理、连接设置入口、退出 | 仅登录后显示；不占访客主导航 |

不建立空的 Knowledge、Tools、Workflow 导航。没有真实闭环时，不预留一排“即将上线”。全局设置只有在出现跨模块真实配置后再独立。

关系：公开内容来自明确发布动作；工作台调用 AI Core；日报管理也调用 AI Core；门户本身不需要读取私有房间统计来证明“活跃”。

## 22. Target Technical Architecture

目标是未来 2～3 年能逐步扩展的模块化单体；扩展由真实需求触发。

~~~mermaid
flowchart TB
    UI[Portal / Chat / Daily Admin UI] --> Entry[Routes / Access Policy / Validation]
    Entry --> Chat[Conversation Services]
    Entry --> Daily[Daily Services]
    Entry --> Content[Small Content Modules]
    Chat --> Core[AI Core]
    Daily --> Core
    Core --> Registry[Model Registry / Capability]
    Core --> Prompt[Domain Prompt Builders]
    Core --> Adapter[Provider Adapters]
    Adapter --> Transport[Safe HTTP / Timeout / Abort / Error Mapping]
    Chat --> Store[(SQLite Repositories)]
    Daily --> Store
    Content --> Store
    Entry --> Obs[Request / Run / Step Observability]
    Core --> Obs
    Future[未来明确需求] -.-> Tools[受控 Tool / Agent / Knowledge 模块]
    Tools -.-> Core
~~~

保持现有目录，逐步明确职责：

- API：鉴权、输入校验、调用服务、输出公开字段，不编排厂商请求。
- Conversation：消息、轮次、上下文策略、失败策略；不依赖 React。
- AI Core：模型能力、统一请求/响应、adapter、取消与错误、Prompt 构建约定。日报与 Chat 均是消费者。
- Provider Adapter：协议差异；公共传输负责超时、目标校验、重定向、响应边界。
- Persistence：同一进程稳定客户端；业务事务局部定义；跨外部网络请求不长时间占用 SQLite 写事务。
- Authentication：继续单所有者模式，统一公开/私有数据查询，默认不公开草稿。
- Observability：关联 requestId / runId / roundId / stepId，只记必要元数据，避免原始密钥与全文泛滥。
- Jobs：先让运行可取消、可辨别失败、可重启识别；确有持续后台任务需求时，再增加 SQLite 任务表和单 worker，不立即引入 Redis。

新厂商的验收契约应覆盖：密钥不回传、连接测试、成功内容、超时/429/无效 key、上下文、取消、能力不支持的明确提示。为兼容厂商只增加目录配置；为新协议增加 adapter、能力登记和契约测试，业务编排保持稳定。

Agent/Tool/MCP 尚不实现。将来确需时，工具必须有名称、输入 schema、允许范围、超时、审核/确认语义、结果记录；不能把不可信网页内容变成工具授权。Memory/Knowledge 也应先界定保存什么、何时检索、如何删除，再决定是否需要 embedding。

Workspace 当前可视为隐式个人空间，不增加空表；多用户需求真实出现时再引入所有权模型和数据迁移。

## 23. Revival Roadmap

工期为单人专注工作量估计，不含等待凭据、业务决策和线上维护窗口。以验收结果推进。

| 阶段 | 工作 | 完成标准 | 参考工作量 |
| --- | --- | --- | --- |
| Phase 0 恢复基线 | 安全备份；处理潜在泄露凭据；从 257fbea 建独立恢复分支；修 Prisma；验证迁移；整理启动与测试入口 | 可复现 dev/build/start；生产建房间与核心事务通过；原库可恢复 | 2～4 天 |
| Phase 1 稳定核心 | 公共日报过滤、发布幂等、采集失败语义、首页刷新、SSRF 传输；类型/smoke 修复；落实群聊失败契约 | 单聊/群聊/续聊及日报公开闭环有生产集成回归；故障不会伪成功或泄露草稿 | 4～7 天 |
| Phase 2 产品骨架 | 更新 README/AGENTS 事实与范围；整理所有者入口；错误/空态；删误导承诺 | 访客阅读、所有者聊天、管理发布三条路径清楚 | 2～4 天 |
| Phase 3 AI Core 演进 | 仅提取共用传输/错误/能力；按痛点支持取消或原生 adapter；拆热点组件 | 新 adapter 可独立契约测试，业务/UI 无散落厂商调用 | 5～10 天，按需求拆交付 |
| Phase 4 扩展个人网站 | 选择一个真实场景：项目内容、文章或一个重复使用工具 | 能说明使用频率、数据归属、退出成本；稳定性不退化 | 不预排大包功能 |

Phase 0/1 不做 UI 全面重设计。先用合成数据和 mock 建立稳定路径，再使用专门测试凭据做最小真实厂商验证。公开部署需额外确认生产配置、数据库备份、迁移、回滚及匿名边界；本报告不是部署许可或线上验收。

恢复分支应基于 257fbea，在独立工作树操作；不能直接把现有 main 与已迁移数据库混用。当前 next-env.d.ts 和所有未跟踪用户材料先保留。

## 24. Priority Matrix

Risk 指改动/执行风险；P0 为恢复或安全阻断，P1 为上线前必须修，P2 为稳定后改善，P3 为按需求投入。

| 任务 | Priority | Impact | Effort | Risk | 依赖 / 验收 |
| --- | --- | --- | --- | --- | --- |
| 核对并撤销可能泄露的凭据 | P0 | High | Low | Medium | 不展示值；核对使用方，避免误断服务 |
| 安全快照与独立恢复分支 | P0 | High | Low | Low | 保留原库/工作区；验证恢复 |
| Prisma 生命周期修复 | P0 | High | Low | Medium | 真实 SQLite + production 集成回归 |
| 未发布日报公开隔离 | P1 | High | Low | Low | list/detail/RSS/page 匿名边界一致 |
| 重复发布保留成功版本 | P1 | High | Medium | Medium | 已发布→失败/不足/重试不撤稿 |
| 日报失败状态真实汇总 | P1 | High | Low | Low | 全失败/部分失败/全成功可区分 |
| 首页刷新策略 | P1 | Medium | Low | Low | build 后新增日报可见 |
| 日报安全抓取 | P1 | High | Medium | Medium | 私网/重定向/超时/大响应测试 |
| 原库密钥迁移与 checksum 调查 | P1 | High | Medium | High | 先副本演练，不 reset 原库 |
| 定向依赖安全更新 | P1 | High | Medium | Medium | 刷新公告；兼容/鉴权回归 |
| 统一失败策略与规范 | P1 | High | Low | Medium | 现行默认失败即停；测试明确 |
| 修类型与 UI smoke / 生产测试入口 | P1 | High | Medium | Low | 单独 typecheck、可靠 mock、关键生产闭环 |
| Windows 启动脚本 | P2 | Medium | Low | Low | dev:local 在目标 Node 版本可用 |
| 备份一致性 / 恢复演练 | P1 | High | Medium | Medium | 活跃写入场景恢复检查 |
| 轮次崩溃恢复与任务状态 | P2 | Medium | Medium | Medium | 重启后不长期卡 RUNNING |
| 管理入口、错误、可访问性 | P2 | Medium | Medium | Low | 三条用户路径与键盘操作验收 |
| 分拆巨型组件 / pipeline | P2 | Medium | Medium | Medium | 先有行为覆盖，不同时改产品规则 |
| 原生新协议 / token 流 / 取消 | P3 | Medium | Medium | Medium | 由真实使用需求触发 |
| Agent / RAG / 插件市场 | P3 | Unknown | High | High | 当前不立项 |

第一批高收益低成本工作是 Prisma、公开发布过滤、扫描结果、首页刷新；凭据处理与原库备份同步优先。大重构排在这些之后。

## 25. Immediate Next Actions

第一批实施建议以小范围补丁交付，每批都有明确验收：

1. 从 257fbea 建立隔离恢复工作树，记录原数据库备份和恢复结果；保留现有工作区。
2. 修 Prisma 实例生命周期，加入真实 SQLite 的生产交互事务、建房间、消息保存回归。不要让“验证故障存在”的 probe 被误当成正常成功测试。
3. 将公开日报读取限定 PUBLISHED，覆盖无参数列表、显式 DRAFT/SKIPPED、详情、页面、RSS；私有管理使用独立授权查询。
4. 修日报发布状态机、扫描汇总和首页缓存；用同一期重复运行、空候选、来源全失败验证。
5. 统一抓取安全边界；修类型 fixture 和 smoke 的依赖注入；选择一次真实模型成功闭环验证。
6. 另列安全运维任务处理潜在泄露凭据、历史跟踪备份和原库加密，不把危险历史清理混进普通代码补丁。

仅凭代码无法最终决定的三个产品问题，供开始后续开发时集中确认：

- 公开网站未来主要展示 AI 日报，还是个人项目/文章？当前建议以已经存在的日报为主，保留简洁项目展示。
- 群聊失败后是否仍采用现行规范的“停止后续模型”？当前实现继续，需要显式决定才可改变规范。
- 日报是否允许自动公开发布？当前建议先让生成、审核状态和发布边界可靠，再决定自动化程度。

这些问题不妨碍完成审计，也不妨碍修复事务、权限、错误状态等明确缺陷。

## 26. CTO Recommendations

### 六个最终判断

1. **项目现在是什么？** 个人 AI 门户，内含私有多模型工作台与 AI 日报发布系统；还不是 Agent 平台或个人 AI OS。
2. **完成度约多少？** 以当前已经落地的门户、聊天、日报范围衡量，功能实现约 65%～80%，可稳定交付程度约 45%～60%。这是基于链路和缺陷的主观区间，不是代码行数统计，也不把未立项的 RAG/Agent 计入分母。存在 P0 即不能发布。
3. **三个最大问题？** 生产数据库客户端错误；敏感数据与公开内容边界不完整；版本/文档/测试未形成同一可信基线，导致“有功能却找不到、测试绿但生产坏”。
4. **三个最有价值的资产？** 已分层的模型调用和顺序编排；房间/消息/轮次/事件的数据与测试资产；日报来源—聚类—发布链路以及已经形成的门户入口。
5. **最应阻止的三件事？** 继续堆 Agent/RAG/工具入口；整体换栈或重写 UI/后端；未处理版本、原库和凭据就直接切分支迁移或部署。
6. **最希望马上做的三件事？** 固定较新源码与安全数据基线；修生产事务及公开发布边界；建立覆盖真实数据库、生产模式和核心用户路径的少量高价值回归。

### 长期文档与人类 + AI 协作

项目已经有部署、运维、安全、Provider、日报与前端交接文档，不需要一次新增九份重复说明。缺的是版本清晰的入口与一致的事实。

本次新增：

- PROJECT_OVERVIEW.md：当前身份、版本陷阱、模块入口、约束与下一步。
- PROJECT_RECOVERY_REPORT.md：本报告，保存完整诊断和规划。
- recovery/2026-09-05/VERIFICATION.md 与脱敏证据：保存测试范围、失败、复现条件和日期。

下一实施阶段按实际变更维护：

| 文档 | 何时创建 / 更新 | 避免重复 |
| --- | --- | --- |
| README / AGENTS | 确认阶段范围、失败契约后 | README 讲启动/范围；AGENTS 讲协作约束 |
| ARCHITECTURE / AI_ARCHITECTURE / DATABASE | 对应边界真正发生变化时 | 从本报告提炼当前事实，报告保留历史快照 |
| PRODUCT / ROADMAP | 三个产品问题作出决定时 | 只记录承诺范围、验收和暂缓项 |
| DEVELOPMENT | 启动、迁移、测试路径修好后 | 指向可运行命令，不复制运维全文 |
| DECISIONS 或 docs/adr | 有真实架构取舍时 | 区分 Proposed / Accepted / Superseded |
| CHANGELOG | 首批恢复补丁交付后 | 记录行为变化及迁移注意，不复制 Git log |

每份 ADR 只需背景、选择、原因、代价、回滚和验证。首批候选是：单体 + SQLite、公开门户/私有工作区、群聊失败策略、日报发布模式；目前属于建议，不应伪装成已批准决策。

新 AI 接手顺序：读概览 → 检查当前 SHA/差异 → 读任务相关 ADR/模块 → 确认数据与权限边界 → 小改动 → 对应验证 → 更新交接。交接记录必须区分“改了什么”“测了什么”“没测什么”，并保留日期和提交 SHA。

不能随意修改的区域：原数据库与迁移历史、密钥/访问控制、消息排序与历史快照、群聊失败契约、公开发布状态、其他工作树和私人材料。禁止将数据库或凭据样本重新放入普通文档/测试仓库。

最终建议是先投入一轮集中恢复，把现有系统变成可信的日常工具，再依据真实使用扩展。当前资产值得继续，最大的收益来自修正生命周期、数据可见性和验证方式。
