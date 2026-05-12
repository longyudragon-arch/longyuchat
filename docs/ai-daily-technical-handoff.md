# AI 日报技术交接文档

更新日期：2026-05-09  
适用仓库：LongyuChat / `C:\codeX`  
当前分支：`codex/huashu-frontend-deep-optimization`

## 1. 当前定位

AI 日报是 LongyuChat 门户中的一个独立内容模块，目标不是做视频，也不是人工 CMS，而是把 AI 领域的公开信息源自动抓取、聚类、筛选、中文编辑并发布成可归档、可订阅、可追踪来源的日报。

当前已经落地的能力：

- 公开页面：日报首页、日报详情、历史归档、RSS。
- 后台页面：日报来源管理、兴趣配置、运行记录、手动扫描、手动发布。
- 自动链路：`scan -> source items -> story clusters -> publish -> issue/items/source links -> RSS`。
- 数据存储：Prisma + SQLite，已有迁移表。
- 模型生成：复用聊天室已有模型配置和 provider adapter，不单独硬编码大模型 API。
- 调度入口：npm scripts + bearer token，可接服务器 cron。

当前还不是完整内容运营系统，缺少：

- pipeline 级自动化测试。
- 可视化编辑器和人工改稿流程。
- 更强的跨源聚类算法。
- 更严格的反垃圾、去重、可信度规则。
- 生产级 webhook/队列/任务锁。

## 2. 技术栈

- Next.js 16 App Router：页面和 API 路由。
- React 19：后台管理页使用 client component。
- TypeScript strict：共享类型集中在 `types/daily.ts`。
- Prisma 7 + SQLite：日报表在 `prisma/schema.prisma` 和 migrations 中。
- Zod：API request body/query 校验。
- 原生 `fetch`：RSS、GitHub、HN、Reddit 抓取没有引入新依赖。
- 现有模型适配层：`server/adapters` + `model_configs`，AI 日报通过 `daily-ai-service` 调用。
- Tailwind/CSS 变量：门户统一视觉类名，如 `ly-page-wrap`、`ly-shell`、`ly-glass`、`ly-surface-card`。
- Cron/npm scripts：服务器定时执行扫描和发布。

## 3. 关键目录

```text
app/daily/
  page.tsx                  # 日报公开首页
  [slug]/page.tsx            # 日报详情页
  archive/page.tsx           # 历史归档和搜索

app/admin/daily/page.tsx     # 日报后台入口
components/daily-admin-page.tsx

app/api/daily/
  issues/route.ts            # 公开 issues 列表
  issues/[slug]/route.ts     # 公开单期详情
  rss/route.ts               # RSS XML
  admin/sources/*            # 来源管理
  admin/interests/*          # 兴趣配置
  admin/runs/*               # 扫描、发布、运行记录

server/services/
  daily-ai-service.ts
  daily-config-service.ts
  daily-default-source-service.ts
  daily-fetch-service.ts
  daily-feed-service.ts
  daily-interest-service.ts
  daily-issue-service.ts
  daily-pipeline-service.ts
  daily-run-service.ts
  daily-source-service.ts

lib/daily-presentation.ts    # 前端展示辅助：日期、分类、hero 文案、来源域名等
types/daily.ts               # 日报共享类型
scripts/daily-*.mjs          # 自动化脚本
ai-daily/                    # 早期规划文档
docs/ai-daily-technical-handoff.md
```

## 4. 数据模型

日报相关 Prisma enum：

- `DailySourceKind`：`RSS`、`GITHUB_RELEASES`、`GITHUB_REPO_EVENTS`、`HACKERNEWS`、`REDDIT`、`WEB_FEED`。
- `DailyStoryClusterStatus`：`PENDING`、`SELECTED`、`REJECTED`。
- `DailyIssueStatus`：`DRAFT`、`PUBLISHED`、`SKIPPED`。
- `DailyIssueCategory`：`HEADLINES`、`MODEL_RELEASES`、`DEV_ECOSYSTEM`、`PRODUCT_UPDATES`、`TECH_INSIGHTS`、`RUMORS`。
- `DailyIssueItemCertainty`：`CONFIRMED`、`WATCHLIST`、`RUMOR`。
- `DailyRunType`：`SCAN`、`PUBLISH`、`BACKFILL`、`REPUBLISH`、`REBUILD_RSS`。
- `DailyRunStatus`：`RUNNING`、`SUCCESS`、`FAILED`。
- `DailyRunStepStatus`：`PENDING`、`RUNNING`、`SUCCESS`、`FAILED`、`SKIPPED`。

核心表：

- `daily_sources`：信息源配置。包含 `kind`、`base_url`、`feed_url`、`config_json`、`enabled`、`priority`、`last_fetched_at`。
- `daily_source_items`：原始抓取条目。使用 `source_item_key` 唯一去重，保留 canonical URL、标题、作者、正文摘要、语言、内容 hash。
- `daily_story_clusters`：故事聚类。当前主要用 canonical URL / 标题 hash 聚合，保存 score、status、summary draft、editorial reason。
- `daily_story_cluster_items`：聚类和原始条目的关联表，支持一个 cluster 关联多个来源条目。
- `daily_issues`：日报期刊。按 `issue_date` 和 `slug` 唯一，状态为 draft/published/skipped。
- `daily_issue_items`：日报中的具体条目。包含栏目、可信度、标题、摘要、正文、主来源、排序、是否重点。
- `daily_issue_item_sources`：一个日报条目的多个来源链接。
- `daily_interest_profiles`：兴趣配置。包含优先关键词、排除关键词、编辑偏好文本、启用状态和优先级。
- `daily_runs`：一次扫描/发布运行记录。
- `daily_run_steps`：运行过程中的每个 source step，用于后台排查。

相关迁移：

- `20260422040000_add_ai_daily_tables`
- `20260422150000_add_daily_categories_and_sources`
- `20260422165000_add_daily_interest_profiles`

## 5. 服务层职责

### `daily-config-service.ts`

集中读取环境变量，避免业务层散落配置。

重要配置：

- `AI_DAILY_ENABLED`：功能开关，默认 true。
- `AI_DAILY_MODEL_ID`：指定日报生成模型。为空时使用第一个 enabled 模型。
- `AI_DAILY_AUTOMATION_TOKEN`：自动化脚本调用 scan/publish 的 bearer token。
- `AI_DAILY_CANDIDATE_LIMIT`：发布候选 cluster 数，默认 12。
- `AI_DAILY_PUBLISH_ITEM_LIMIT`：每期发布条目数，默认 6。
- `AI_DAILY_MINIMUM_ITEM_COUNT`：候选不足时跳过发布，默认 3。
- `AI_DAILY_HEURISTIC_SCORE_THRESHOLD`：scan 阶段标记 selected 的分数阈值，默认 4.5。
- `AI_DAILY_PUBLISH_WINDOW_HOURS`：发布扫描窗口，默认 24。
- `AI_DAILY_FEED_BASE_URL`：RSS 和链接使用的站点域名。
- `AI_DAILY_GENERATION_TIMEOUT_MS`：日报生成超时，默认复用 provider request timeout。
- `AI_DAILY_TIMEZONE`：默认 `Asia/Shanghai`。

### `daily-fetch-service.ts`

负责从外部信息源抓数据并归一化为 `UpsertDailySourceItemInput`。

当前支持：

- RSS / Atom。
- GitHub releases。
- GitHub repo events。
- Hacker News Firebase API。
- Reddit JSON 或 RSS。
- 通用 web feed 占位。

关键逻辑：

- URL canonicalize：去掉常见 `utm_*`、`ref`、`source` 和 hash。
- source item key：基于 external id / canonical URL / title 生成 sha1。
- content hash：基于标题和内容生成 sha1。
- 轻量语言识别：中文字符占比高则 `zh-CN`，否则 `en`。
- 没有额外 npm 抓取依赖，维护成本低，但 RSS 解析不如专业 parser 完整。

### `daily-source-service.ts`

负责来源 CRUD 和 source item upsert。

后台页面和 scan worker 都依赖它。来源配置通过 `configJson` 保存 provider-specific 参数，例如：

```json
{"limit":20}
```

Hacker News 示例：

```json
{"storyList":"topstories","limit":20,"minScore":40}
```

### `daily-interest-service.ts`

负责兴趣配置 CRUD。

当前实际使用方式：

- scan 阶段：include keywords 命中会加分；exclude keywords 命中会直接标记 `REJECTED`。
- publish 阶段：把兴趣描述、优先关键词、排除关键词附加进 AI 编辑 prompt。

这部分是从 TrendRadar 类项目中吸收过来的“趋势筛选/关注方向”思路，但没有直接引入 TrendRadar 代码或依赖。

### `daily-ai-service.ts`

复用 LongyuChat 已有模型配置调用大模型。

模型选择策略：

1. 如果设置 `AI_DAILY_MODEL_ID`，使用指定 enabled model。
2. 如果未设置，使用 `listModelConfigs()` 返回的第一个 enabled model。
3. 如果没有可用模型，返回 null，让发布链路走 fallback。

生成方式：

- `generateAiDailyText`：普通文本生成。
- `generateAiDailyJson<T>`：要求模型输出 JSON，自动剥离 markdown code fence 后 parse。

结论：不需要为 AI 日报单独购买新的“大模型 API”，但整个站点至少需要一个可用的大模型配置，才能产出高质量中文日报。没有模型时也能 fallback 发布，但质量会明显下降，容易出现标题/摘要不够中文、不够吸引人的问题。

### `daily-pipeline-service.ts`

这是日报核心编排层。

`runDailyScan()`：

1. 创建 `daily_runs` 记录，类型 `SCAN`。
2. 读取 enabled sources。
3. 读取 active interest profile。
4. 逐个 source 创建 run step。
5. 调用 `fetchDailySourceItems(source)`。
6. upsert 到 `daily_source_items`。
7. 生成 cluster key，upsert 到 `daily_story_clusters`。
8. 计算启发式分数和兴趣加权。
9. 命中排除词则 `REJECTED`，超过阈值则 `SELECTED`，否则 `PENDING`。
10. 写入 `daily_story_cluster_items` 关联。
11. 完成 run stats。

启发式评分主要看：

- 来源类型权重。
- 标题和正文关键词，如 OpenAI、Anthropic、Gemini、Grok、DeepSeek、Qwen、LLM、agent、reasoning、release、model、benchmark、inference、Copilot、MCP。
- 新鲜度。
- 兴趣 include keywords 加分。
- 兴趣 exclude keywords 排除。

`runDailyPublish()`：

1. 计算 issue date。默认按 `AI_DAILY_TIMEZONE`，目前是 `Asia/Shanghai`。
2. 当前日期使用 rolling window；显式 date 使用该本地日的 UTC window。
3. 查询 `PENDING` / `SELECTED` clusters，按 score 和 publishedAt 排序。
4. 如果候选数低于 `AI_DAILY_MINIMUM_ITEM_COUNT`，创建/更新 issue 并标记 `SKIPPED`。
5. 构造中文编辑 prompt，让模型输出严格 JSON。
6. 如果模型失败或 JSON 无效，走 fallback issue。
7. 如果 draft 英文比例过高，二次调用模型转中文。
8. 创建或更新 `daily_issues`。
9. 替换 `daily_issue_items` 和 `daily_issue_item_sources`。
10. 对条目再次做中文本地化兜底。
11. 发布 issue，状态设为 `PUBLISHED`。

`buildDailyRssXml()`：

- 读取最近 30 期 published issues。
- 使用 `AI_DAILY_FEED_BASE_URL` 生成 RSS link。
- 输出 `application/rss+xml`。

### `daily-issue-service.ts`

负责日报 issue 的查询、统计、draft 创建/更新、发布、状态设置、条目替换。

重点：

- `getDailyIssueStats()` 为门户统计提供已发布期数、总条目数、最新日期。
- `replaceDailyIssueItems()` 使用事务先删旧 items/source links，再创建新 items/source links。
- 约束同一期里 cluster 和 sort order 唯一，避免重复条目。

### `daily-run-service.ts`

负责 run 和 step 状态管理。后台运行记录依赖它排查 scan/publish 是否成功。

### `daily-feed-service.ts`

手写 RSS XML，包含 XML escaping、issue URL、description、lastBuildDate。

### `daily-default-source-service.ts`

默认来源 seed：

- OpenAI News
- Hugging Face Blog
- Google AI Blog
- Hacker News Top Stories
- Reddit `/r/MachineLearning`
- Reddit `/r/LocalLLaMA`
- GitHub releases `/huggingface/transformers`
- GitHub releases `/vercel/ai`

注意：`scripts/daily-seed-defaults.mjs` 会调用 `/api/daily/admin/sources/seed`。当前 proxy 只给 scan/publish 开了 automation token bypass，所以生产环境 `APP_AUTH_SCOPE=chat` 下，这个脚本可能因为没有登录 cookie 而 401。生产首次 seed 更稳的方式是登录后台点按钮，或后续单独决定是否允许 seed 也使用 automation token。

## 6. API 路由

公开 API：

- `GET /api/daily/issues?status=PUBLISHED&limit=20`
- `GET /api/daily/issues/[slug]`
- `GET /api/daily/rss`

后台 API：

- `GET /api/daily/admin/sources`
- `POST /api/daily/admin/sources`
- `PUT /api/daily/admin/sources/[id]`
- `DELETE /api/daily/admin/sources/[id]`
- `POST /api/daily/admin/sources/seed`
- `GET /api/daily/admin/interests`
- `POST /api/daily/admin/interests`
- `PUT /api/daily/admin/interests/[id]`
- `DELETE /api/daily/admin/interests/[id]`
- `GET /api/daily/admin/runs`
- `POST /api/daily/admin/runs/scan`
- `POST /api/daily/admin/runs/publish`

鉴权：

- `/daily`、`/daily/*`、`/api/daily/issues`、`/api/daily/rss` 是公开访问。
- `/admin/*` 和 `/api/daily/admin/*` 受 `APP_AUTH_SCOPE` 保护。
- 推荐生产：`APP_LOGIN_ENABLED=true`、`APP_AUTH_SCOPE=chat`、`BASIC_AUTH_ENABLED=false`。
- scan/publish 两个接口额外允许 `Authorization: Bearer $AI_DAILY_AUTOMATION_TOKEN`，便于 cron 自动跑。

CSRF/Content-Type：

- mutating API 必须 `Content-Type: application/json`。
- proxy 会做 same-origin / same-site origin 检查。

## 7. 页面说明

### `/daily`

日报门户页，展示：

- 最新一期入口。
- 已发布期数。
- 总条目数。
- 最近更新日期。
- 近期日报列表。
- 历史归档入口。
- RSS 订阅入口。
- 日报后台入口。

### `/daily/[slug]`

详情页，展示：

- hero 标题和摘要。
- 本期目录。
- 重点条目。
- 按栏目分组。
- 每条的可信度、栏目、摘要、正文、来源链接。

展示辅助来自 `lib/daily-presentation.ts`：

- `groupDailyItemsByCategory`
- `buildDailyHeroCopy`
- `getDailyIssueDek`
- `estimateDailyReadMinutes`
- `getDailySourceHost`

### `/daily/archive`

归档页，支持：

- 最近 200 期列表。
- `q` 参数按日期、标题、摘要搜索。
- 统计展示。

### `/admin/daily`

后台页，当前集中在 `components/daily-admin-page.tsx`，是一个偏大的 client component。它做了：

- 加载 sources、interest profiles、runs、issues。
- 新增/编辑/启停/删除来源。
- seed 默认来源。
- 新增/编辑/启停/删除兴趣配置。
- 手动 scan。
- 手动 publish。
- 展示运行记录和 issue 统计。

后续如果继续优化，建议拆分成：

- `DailySourcePanel`
- `DailyInterestPanel`
- `DailyRunPanel`
- `DailyIssuePanel`
- `useDailyAdminState`

## 8. 调度方案

本地或服务器都走 npm scripts：

```bash
npm run daily:seed-defaults
npm run daily:scan
npm run daily:publish
npm run daily:publish -- 2026-05-09
```

脚本实现：

- `scripts/daily-api-client.mjs`：解析站点 base URL，附带 bearer token。
- `scripts/daily-scan.mjs`：POST `/api/daily/admin/runs/scan`。
- `scripts/daily-publish.mjs`：POST `/api/daily/admin/runs/publish`，可传日期。
- `scripts/daily-seed-defaults.mjs`：POST `/api/daily/admin/sources/seed`。

生产 cron 推荐：

```cron
0 */2 * * * cd /srv/longyuchat/app && /usr/bin/npm run daily:scan >> /srv/longyuchat/var/log/daily-scan.log 2>&1
0 8 * * * cd /srv/longyuchat/app && /usr/bin/npm run daily:publish >> /srv/longyuchat/var/log/daily-publish.log 2>&1
```

前提：

- `.env` 中有 `AI_DAILY_AUTOMATION_TOKEN`。
- `LONGYUCHAT_APP_URL` 或 `NEXT_PUBLIC_APP_URL` 或 `APP_BASE_URL` 或 `AI_DAILY_FEED_BASE_URL` 指向实际站点。
- 服务本身运行正常。
- 数据库已完成 migrations。
- 至少配置了一个 enabled 模型，或者接受 fallback 质量。

## 9. 环境变量建议

```env
APP_LOGIN_ENABLED=true
APP_AUTH_SCOPE=chat
BASIC_AUTH_ENABLED=false
ALLOW_UNPROTECTED_ACCESS_IN_PRODUCTION=false

AI_DAILY_ENABLED=true
AI_DAILY_MODEL_ID=
AI_DAILY_AUTOMATION_TOKEN=replace-with-random-token
AI_DAILY_CANDIDATE_LIMIT=12
AI_DAILY_PUBLISH_ITEM_LIMIT=6
AI_DAILY_MINIMUM_ITEM_COUNT=3
AI_DAILY_HEURISTIC_SCORE_THRESHOLD=4.5
AI_DAILY_PUBLISH_WINDOW_HOURS=24
AI_DAILY_FEED_BASE_URL=https://longyu.chat
AI_DAILY_GENERATION_TIMEOUT_MS=
AI_DAILY_TIMEZONE=Asia/Shanghai
```

模型相关：

- 日报不直接保存新的 API key。
- 它使用现有 `model_configs`。
- 如果希望固定日报模型，就设置 `AI_DAILY_MODEL_ID`。
- 如果不设置，则使用第一个 enabled model，可能导致质量和成本不可控。

## 10. 当前质量和测试状态

已有测试：

- `tests/daily-feed-service.test.ts`
- `tests/daily-default-source-service.test.ts`

主要缺口：

- `daily-pipeline-service.ts` scan/publish 没有单元测试。
- 外部 source fetcher 没有 mock fetch 测试。
- `/api/daily/admin/*` 没有 route 层测试。
- cron 脚本没有端到端测试。
- `components/daily-admin-page.tsx` 偏大，缺少拆分。

推荐下一轮补测试顺序：

1. mock Prisma + mock fetch，覆盖 `runDailyScan()`：去重、include 加分、exclude reject、run step 成功/失败。
2. mock AI service，覆盖 `runDailyPublish()`：正常 JSON、AI 失败 fallback、候选不足 skipped、中文二次本地化。
3. route 层测试：admin 鉴权、Zod 校验、错误响应。
4. RSS snapshot 测试。

## 11. 已吸收的产品思路

来自橘鸦类 AI 日报的可学习点：

- 先给结论，再给来源。
- 详情页按栏目组织，而不是纯时间流。
- 顶部 hero 要有“今天为什么值得看”的判断。
- 每条内容保留多个 source link，方便查证。
- 中文表达优先，避免英文标题堆在页面上。

来自 TrendRadar 类项目的可学习点：

- 信息源 registry。
- 扫描任务和运行日志。
- 候选事件评分。
- 兴趣关键词配置。
- 后续可扩展为多频道、多主题、多站点输出。

当前实现是“借鉴架构思路”，不是直接复制外部项目代码。

## 12. 新线程优先任务

建议新线程不要重新讨论“要不要做日报”，直接基于本文档继续：

1. 修正生产 seed 自动化：决定 `/api/daily/admin/sources/seed` 是否允许 `AI_DAILY_AUTOMATION_TOKEN`。
2. 给 `daily-pipeline-service.ts` 补核心测试。
3. 拆分 `components/daily-admin-page.tsx`。
4. 优化 AI prompt，让标题更像中文门户头条，减少 fallback 英文泄漏。
5. 增加手动改稿/重新发布能力。
6. 增加“来源可信度/黑名单/白名单”规则。
7. 优化跨源聚类，避免同一新闻不同 URL 重复出现。

## 13. 新线程提示词

可以直接复制下面这段开新线程：

```text
你现在接手 LongyuChat 项目的 AI 日报模块。请先阅读并严格以这个交接文档为准：

C:\codeX\docs\ai-daily-technical-handoff.md

项目目录是 C:\codeX，当前站点是一个 AI 总站，已有 AI 日报、AI 聊天室、项目推荐、个人简介等门户页面。AI 日报的目标是全自动抓取 AI 公开信息源，聚类筛选，调用站内已配置的大模型生成中文日报，发布到 /daily，并支持历史归档和 RSS。

请先做只读理解，不要马上大改。重点确认：
1. Prisma 数据表和 migrations 是否与文档一致。
2. scan/publish pipeline 是否有明显 bug 或测试缺口。
3. 生产自动化中 daily:seed-defaults 是否会被鉴权拦住。
4. 首页、详情页、归档页、后台页的入口和体验是否顺。
5. 下一步最应该先做什么，按风险和收益排序。

我的优先级是：
1. 日报全自动稳定运行。
2. 中文标题和顶部头版足够吸引人。
3. 来源可查证。
4. 后台能排查问题。
5. 不要引入复杂依赖，不要破坏现有 AI 聊天室。

请先输出一份基于当前代码的评估和执行计划；如果要改代码，先说明会改哪些文件、为什么改、如何验证。
```
