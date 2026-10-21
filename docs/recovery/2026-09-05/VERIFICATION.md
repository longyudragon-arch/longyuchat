# 恢复审计验证记录

实验日期：2026-09-05。报告与源码引用复核：2026-09-20。

## 范围和隔离

- 原仓库：C:/codeX；HEAD 为 7e29b4f62f9d115d9ada6a73c53beebd095a6a14。
- 主要运行基线：257fbeafb08b16c7d126e7e8d8ec7c801184b787。
- 工作目录：C:/Users/11501/.codex/tmp/project-recovery-20260905/latest。
- 从 Git blob 提取源码；未将原 .env、原数据库、真实密钥、私人笔记复制进运行副本。
- 合成数据库、假模型配置、本机 feed fixture、一次性登录配置用于实验。
- 未切换原分支、未迁移原库、未部署、未请求真实收费 Provider。
- 原数据库只进行了完整性、结构、迁移与凭据存储形式的只读检查；报告只保留汇总。
- 9 月 20 日确认两个 SHA 未变，审计端口 3181～3185 无监听；没有宣称服务器仍在运行。

本目录是历史证据，不是应用测试目录。recovery-prisma-probe.test.ts.txt 故意保留 .txt 后缀，避免未来测试收集器误执行。它的断言是“旧故障存在”，不能纳入修复后的正常通过标准。

## 命令与结果

实验时使用 Node 24.14.1、npm 11.11.0。先安装，再在独立环境设置数据库与合成配置。以下为实际检查入口，不是要求在 C:/codeX 原库执行：

~~~powershell
npm ci --no-fund
npm run lint
npm test
npm run build
npx tsc --noEmit --incremental false
npm run prisma:migrate:deploy
npm run dev:local -- --hostname 127.0.0.1 --port 3183
npm run test:ui:smoke
~~~

| 项目 | 结果 / 证据 |
| --- | --- |
| 安装 | 成功，511 packages；Prisma client 生成 |
| lint | [lint-latest.log](lint-latest.log)，通过 |
| tests | [test-latest.log](test-latest.log)，38 文件 / 258 测试通过 |
| build | [build-latest.log](build-latest.log)，通过；根页面静态 |
| typecheck | [typecheck-summary.json](typecheck-summary.json)，119 诊断 / 15 个测试文件 |
| 初始 migration | 不存在的新 SQLite 文件报 Schema engine error；相对/绝对 URL 均遇到 |
| 预创建空文件后的 migration | [migrate-latest-precreated.log](migrate-latest-precreated.log)，22 条通过 |
| dev:local | [dev-local-wrapper.log](dev-local-wrapper.log)，spawn EINVAL，定位 start-dev-local.mjs:54 |
| UI smoke | [ui-smoke-latest.log](ui-smoke-latest.log)，等待连接成功文本超时 |
| 生产专项事务 | [prisma-production-probe.log](prisma-production-probe.log)，2 个复现断言通过 |

完整 typecheck 日志保存在 C:/Users/11501/.codex/tmp/project-recovery-20260905/typecheck-latest.log，约 124 KB；本目录仅保存按文件统计，避免重复大段诊断。主要类型问题包括 mock 缺少新增序号/耗时/快照字段、运行状态联合类型不匹配和模块声明缺失。

9 月 20 日补查隔离安装的 node_modules/next/dist/lib/typescript/runTypeCheck.js:118–123：Next.js 16.1.6 对 test/spec 文件诊断进行过滤。这解释了 build 成功与完整 tsc 失败并存，不是声称 Next 构建完全没有类型检查。

### 启动和迁移问题的边界

dev:local 的 npm.cmd 子进程启动失败后，在隔离环境直接运行 Next Node 入口可启动：

~~~powershell
node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3185
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3183
~~~

两条命令分别用于不同阶段，不要求同时占用同一数据库。start 前已 build，并设置隔离数据库和一次性鉴权/加密环境变量。这是为了区分应用运行与脚本平台问题的实验路径，不替代生产 start:prod 的启动检查。

空文件 migration 实验只在新建隔离数据库路径预创建文件，未覆盖任何已有 SQLite 文件。该结果支持“当前 Windows 环境存在初始化条件问题”，不足以认定上游精确原因，也不能说原库迁移失败或迁移 SQL 损坏。

UI smoke 的截图显示 Provider URL is not allowed.；脚本使用 127.0.0.1 mock，安全层拒绝该目标。截图原件位于 C:/Users/11501/.codex/tmp/project-recovery-20260905/latest/output/playwright/ui-smoke-failure.png。这不是外部厂商不可用的证据。后续应隔离测试传输注入，不能全局放开私网请求。

## 关键运行证据

### 1. 生产 / 开发 Prisma 对照

代码：257fbea:lib/prisma.ts:17–43。生产 getPrismaClient 每次创建实例；Proxy 的方法调用使用代理 receiver。

合成模型创建后，生产 POST /api/rooms 返回 500；开发返回 201。真实 SQLite 最小 probe 同时检查：

- 生产同一 model delegate 连续访问不是同一对象。
- 生产交互式事务内执行不存在记录的 deleteMany，抛出 Transaction not found。
- 开发 delegate 保持身份，相同操作返回 count 0。

证据：[probe 源码文本](recovery-prisma-probe.test.ts.txt)、[输出](prisma-production-probe.log)。如复演，必须在独立、已迁移的合成数据库上运行，并由修复后的回归测试改为期待生产成功。最初尝试的 array transaction 没有复现，不构成本报告根因依据。

### 2. API / 身份 / 聊天

[开发证据](api-runtime-evidence-development.json)、[生产证据](api-runtime-evidence-production.json)记录了：

| 请求 / 行为 | 结果 |
| --- | --- |
| 匿名首页/日报/项目/关于 | 200 |
| 匿名 /api/rooms | 401 |
| 匿名 /admin/daily | 307 → login |
| 一次性账号登录 | 200，存在 cookie；证据不保存 cookie 值 |
| 跨站 mutation | 403 |
| 合成模型创建 | 201，响应无 key |
| 模型连接测试（loopback） | 400，Provider URL is not allowed. |
| 开发建房间 | 201 |
| 生产建房间 | 500 |
| 开发模型失败后的发送 | 207，用户消息 sequence 1 保留，历史重载 1 条 |
| SSE | 200，text/event-stream，初始 room-snapshot |

这些实验没有取得真实模型成功回复，因此不能替代完整成功聊天 E2E。群聊顺序和上下文已有单元/mock 证据；失败后继续的当前代码行为与现行规范冲突，另见主报告。

### 3. 日报发布与失败语义

开发模式使用三条合成 feed：

1. 创建来源后 scan：fetched 3 / upserted 3 / clusters 3。
2. 未配置真实 LLM，使用规则降级发布：PUBLISHED，3 条。
3. RSS 返回条目；/daily 指向该期详情。
4. 将合成候选调整为不满足发布条件，再次 publish：已有 issue 变为 SKIPPED。
5. 匿名 detail API 仍返回该期及原有 3 条内容。
6. 将来源响应设为 503，再 scan：HTTP 200，run SUCCESS，step FAILED。

生产模式 scan 在聚类交互事务遇到错误，处理数量减少，整体仍被记录成功。请用开发对照区分“事务故障”和“状态汇总故障”，不要混成一个问题。

loopbackFeedHits 同时证明日报抓取访问到本机 HTTP 服务；配置来源需要管理员权限。这是受权限限制的 SSRF 风险证据，不是匿名攻击演示。

### 4. 首页生产陈旧

先生产 build，之后仅向隔离数据库写入标题为 Recovery Published After Build 的 PUBLISHED 日报；公开 API 读取到该标题，首页没有新标题且仍显示无发布内容。

证据：[homepage-production-probe.json](homepage-production-probe.json) 与 build-latest.log 的根路由静态标记。开发模式首页会更新，不能用开发体验否定生产复现。

### 5. 数据库与静态依赖检查

[database-and-import-evidence.json](database-and-import-evidence.json)保存：

- 原库完整性 ok、外键违规 0。
- 22 条迁移中 2 个原始 checksum 不同。
- 原库模型密钥存储形式：2 加密 / 10 明文；连接 1 加密。
- Git 跟踪备份：8 个模型明文字段，其中至少 2 个非测试凭据样式值；有效性未测试。
- 静态 alias/relative import 图覆盖 123 个源文件，未发现循环。

校正说明：avatar_color 迁移 checksum 可以由 LF/CRLF 解释；interest_profiles 尚无法解释。忽略列顺序、外键编号和索引枚举顺序后，原库与清洁最新迁移库未见业务结构差异，见 [schema-drift-details.json](schema-drift-details.json)。不能把最初机械比较的差异数当成真实 schema 漂移。

## 证据完整性与局限

[manifest.json](manifest.json)列出复制证据的 SHA-256。typecheck-summary 是从原日志生成的摘要，其余列入清单的文件保留原实验内容。此目录不包含原数据库、环境文件、真实凭据或登录 cookie。

未验证：远端新增提交、当前线上 SHA、真实 Provider 成功率、LLM 日报质量、生产 cron、恢复演练、多实例、完整无障碍与所有移动端布局。源码结构检查不等于这些项通过。

2026-09-20 新增的文档与证据经过结构、链接、数字和文件完整性检查；没有修改业务代码，也没有把 9 月 5 日的测试结果冒充为 9 月 20 日重新执行。
