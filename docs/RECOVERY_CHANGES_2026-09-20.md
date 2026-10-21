# LongyuChat 恢复修改与验证

> Publication note: this is the original recovery-session record. The subsequent commits, GitHub publication, English entry-point documentation, and approved commit-title rewrite are recorded in [GitHub synchronization](GITHUB_SYNC_2026-10-21.md). Original SHA values and process IDs below are historical, not current service state.

日期：2026-09-20。对应授权：完成项目审计后，在新分支全面修复现有问题并本地启动。本次不包含新产品能力或线上部署。

## 交付位置

- 分支：`codex/project-recovery-20260920`。
- 工作目录：`C:/Users/11501/.codex/worktrees/longyuchat-recovery/codeX`。
- 基线：`257fbeafb08b16c7d126e7e8d8ec7c801184b787`，包含较新的门户、日报与聊天室。
- 修改保留在该工作目录，尚未 commit 或 push。原 `C:/codeX` 仍为 main `7e29b4f`；原有未提交文件、数据库、日志和其他材料保留。
- 已本地启动：`http://127.0.0.1:3000`，仅监听 `127.0.0.1`，开发环境关闭登录。

## 修改及原因

| 范围 | 具体修改 | 主要文件 |
| --- | --- | --- |
| 生产数据库事务 | 生产进程复用一个 Prisma 客户端，代理方法绑定客户端；恢复建房间及交互式事务 | `lib/prisma.ts` |
| 群聊一致性 | 任一模型失败后停止后续调用，保留用户消息和已有回复；未执行步骤写为 SKIPPED，完成事件与状态同一事务提交；调整前端说明 | `server/orchestrators/conversation-orchestrator.ts`、`server/services/room-message-service.ts`、`conversation-round-service.ts`、`lib/client/longyuchat-client.ts`、`types/app.ts` |
| 日报公开边界 | 公开列表只允许 PUBLISHED，请求草稿状态返回 400；未发布详情返回 404；管理员列表迁至受保护路由 | `app/api/daily/issues/`、`app/api/daily/admin/issues/route.ts`、`components/daily-admin-page.tsx` |
| 首页与导航 | 首页按请求读取最新发布，不冻结在 build 时；补上已有日报管理页面入口 | `app/page.tsx`、`components/app-navigation.tsx` |
| 抓取结果 | 无启用来源返回错误；全部来源失败返回 502 和 FAILED；部分成功显示 PARTIAL 与失败来源数量，运行记录采用 FAILED 以避免误报全成功 | `server/services/daily-pipeline-service.ts`、`types/daily.ts`、`components/daily-admin-page.tsx` |
| 日报发布 | AI JSON 经 schema 校验，候选 ID 去重并检查数量；失败或不足时保留已发布内容；标题、条目、来源和状态原子提交；来源链接使用真实聚类数据 | `server/services/daily-ai-service.ts`、`daily-pipeline-service.ts`、`daily-issue-service.ts` |
| 抓取请求安全 | 限制协议与公开 IP，DNS 解析失败拒绝请求；连接绑定已校验地址，每次重定向重新校验，限制次数、总时间和响应体大小 | `server/http/public-http.ts`、`server/services/daily-fetch-service.ts` |
| Provider 与日志 | 共用严格 URL 校验；PowerShell 传输不自动跟随重定向；日志嵌套敏感字段脱敏 | `server/http/provider-request.ts`、`server/observability/server-logger.ts` |
| 密钥和备份 | 在线 SQLite 一致性备份，校验后原子落盘，只清理本脚本同一数据库命名的过期备份；新增历史密钥加密脚本 | `scripts/sqlite-backup.mjs`、`scripts/encrypt-stored-secrets.mjs` |
| Git 数据卫生 | 停止跟踪数据库备份和 IDE 缓存，文件仍留在磁盘；忽略私有运行数据与新备份 | `.gitignore`、`.vs/slnx.sqlite`、`var/backups/sqlite/2026-03-10-2315-dev.db` |
| Windows 启动 | 通过 Node 直接启动 Next CLI，避免 npm.cmd 的 spawn EINVAL；生产脚本加载 Next 环境文件并保留启动保护 | `scripts/start-dev-local.mjs`、`scripts/start-prod.mjs` |
| 工程验证 | 修正原有 119 个类型诊断对应的测试 fixture；完整 typecheck 纳入 check；mock 隔离到测试子进程，不放宽生产 URL 规则；新增生产 smoke 与真实 SQLite 回归 | `package.json`、`tests/`、`scripts/ui-smoke.mjs`、`scripts/testing/`、`scripts/production-smoke.mjs` |
| 文档 | README/AGENTS 对齐已存在模块，原 MVP 规范另存为历史文档；旧审计保留并标记修复前快照 | `README.md`、`AGENTS.md`、`docs/PROJECT_OVERVIEW.md`、`docs/legacy/MVP_SPEC.md`、`ai-daily/README.md` |

依赖及 lockfile 一起更新：Next.js / eslint-config-next 16.3.5，Prisma 7.10.0，Vitest 4.1.11，PostCSS 8.5.28，并补充 SQLite 驱动类型声明。未做强制跨主版本降级。

## 数据处理证据

原数据库通过 SQLite 在线备份读取到恢复目录，未对原库迁移、reset 或修改。恢复副本保留：

| 数据 | 数量 |
| --- | ---: |
| 模型配置 | 12 |
| 房间 | 28 |
| 消息 | 293 |
| 日报 | 2 |
| 迁移记录 | 22 |

副本 `quick_check = ok`。使用原配置的加密密钥完成 10 条历史明文密钥加密，并验证原有 3 条密文可解密；再次运行返回 `changed: 0, verifiedEncrypted: 13`。不展示密钥内容。

加密前备份位于本工作目录 `var/backups/sqlite/before-secret-encryption-1789890086317.db`，保留用于回退，未进入 Git。该备份仍包含加密前数据，应保持受控访问。原库与恢复副本后续各自独立，新增聊天不会自动同步回原库。

## 验证结果

| 检查 | 结果及范围 |
| --- | --- |
| `npm run check` | PASS：lint、全量 TypeScript、44 文件 / 316 测试 |
| `npm run test:ui:smoke` | PASS：测试登录、连接/模型配置、模型发现、房间编辑、失败后停止、后续续聊、历史重载；使用合成数据库与本地 Provider fixture |
| `npm run build` | PASS：Next.js 生产构建；首页为动态路由 |
| `npm run test:production` | PASS：临时合成数据库与真实 production 服务器，10 项检查覆盖启动保护、私有接口鉴权、草稿隔离、动态首页、CSRF、密钥落库加密、建房事务、失败消息保存、已发布内容保留及被拦截来源的失败记录 |
| SQLite 集成 | PASS：真实生产客户端复用/提交/回滚、消息顺序、日报替换失败回滚及保留来源、群聊步骤与完成事件持久化 |
| 本地页面 | `/`、`/rooms`、`/models`、`/daily`、`/admin/daily` 均 200 |
| 本地 API | rooms / models / public daily issues 均 200，分别返回 28 / 12 / 2 条 |
| 本地监听 | `127.0.0.1:3000`，无对外地址监听 |

本地验证日志：`.codex-check.log`、`.codex-smoke.log`、`.codex-build.log`、`.codex-production.log`。这些属于本机证据，不提交 Git。测试没有验证真实模型凭据有效性、模型回答质量或线上定时任务。

## 本地使用与回退

访问首页 `http://127.0.0.1:3000`，通过导航进入聊天、模型配置和日报管理。本次隐藏后台启动的 launcher PID 为 25624，监听进程 PID 为 25292；PID 只代表本次启动，停止前必须核对进程仍属于该工作目录，不能盲目复用旧 PID。

重新启动：

```powershell
Set-Location C:/Users/11501/.codex/worktrees/longyuchat-recovery/codeX
npm run dev:local -- --port 3000
```

前台运行时 Ctrl+C 停止。后台日志为 `.codex-local.out.log` 和 `.codex-local.err.log`。公网部署必须配置访问保护、会话密钥和密钥加密，并使用 `start:prod` 的启动检查。

回退应用只需停止此工作目录服务，原目录和原始数据库仍在；不要将副本直接覆盖原库。若回退副本内的密钥迁移，先停止写入并另行备份最新副本，再选择恢复本地加密前备份，避免丢失此后的聊天。

## 剩余边界

1. **历史凭据风险未消除**：从当前索引停止跟踪备份不等于从 Git 历史移除。历史密钥是否有效未知；轮换凭据与协调历史清理需在发布前独立处理。本次未连接供应商账号或重写 Git 历史。
2. **迁移历史差异未改写**：旧数据库第二条 migration checksum 差异仍待追溯；结构检查通过。本次在真实副本上未执行 migrate/reset，也未伪造历史记录。
3. **Provider DNS 绑定仍待完善**：日报抓取已绑定校验结果；Provider 的 fetch/PowerShell 传输仍存在校验与实际 DNS 解析分离的窗口，不能宣称所有 SSRF 风险已经消除。
4. **依赖审计仍有 4 个 high 条目**：归于 Prisma CLI 依赖链中的 `deepmerge-ts` / `mysql2` 及上游聚合包，0 critical。自动修复建议 Prisma 6.19.3 跨主版本降级，本轮未强制采用；需要兼容性评估或后续上游修复。
5. **真实运行验证未覆盖**：真实付费模型连接、线上部署、外部调度、不同网络/代理环境和长时间运行。测试使用合成凭据，保留真实模型配置供用户后续使用。

旧审计中尚未纳入本次恢复的架构整理和远期产品规划继续保留在 [完整报告](PROJECT_RECOVERY_REPORT.md)，不把本轮验证等同于全面上线验收。
