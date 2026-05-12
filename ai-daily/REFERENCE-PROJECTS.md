# AI 日报参考项目清单

更新日期：2026-05-09

本文记录 LongyuChat AI 日报模块可以学习的外部项目。用途不是照搬架构，而是把值得吸收的产品形态、数据管线、来源策略和后台排障能力沉淀下来。

## 选型原则

- 优先服务“全自动稳定运行”：定时抓取、失败可见、发布可重复。
- 优先保留来源证据：每条日报内容都能追溯到原始 URL、来源、发布时间和抓取时间。
- 优先改善中文日报体验：标题、头版、栏目和归档比单纯新闻列表更重要。
- 不为了参考项目引入复杂依赖：MCP、多渠道推送、独立云平台、队列和大型爬虫框架都暂缓。
- 不破坏 LongyuChat 现有 AI 聊天室：日报复用现有模型配置和 provider adapter，不另起一套模型调用体系。

## 第一梯队：最值得直接学习

### 1. AI HOT / khazix-skills

- 站点：https://aihot.virxact.com
- 项目：https://github.com/KKKKhazix/khazix-skills
- 定位：中文 AI 信息站 + Agent Skill 接入。

可借鉴点：

- 公共入口清晰：日报、历史归档、条目列表、Agent API 可以形成闭环。
- 分类适合 AI 日报：全新模型、产品动态、行业要闻、论文解读、实用技巧。
- API 形态适合未来对外：`daily`、`dailies`、`items` 这类接口便于 RSS、skill 和外部 Agent 消费。
- Agent skill 的说明强调保留来源 URL，这和 LongyuChat 的“来源可查证”目标一致。

不建议照搬：

- 不要先把 Agent skill 作为主功能。LongyuChat 当前先保证站内日报稳定发布，再开放公共 API 和 skill。

LongyuChat 落点：

- 后续可设计 `/api/public/daily`、`/api/public/daily/{date}`、`/api/public/dailies`、`/api/public/items?mode=selected`。
- 顶部头版可以参考“每日主标题 + 分类栏目 + 来源链接”的结构。

### 2. CloudFlare-AI-Insight-Daily

- 项目：https://github.com/justlovemaki/CloudFlare-AI-Insight-Daily
- 定位：基于 Cloudflare Workers 的 AI 日报内容聚合和发布系统。

可借鉴点：

- 产品形态接近 LongyuChat AI 日报：行业新闻、开源项目、论文、社交讨论、日报标题和静态发布。
- 值得学习“栏目化日报”而不是只做信息流。
- GitHub Pages 发布和历史页面思路可参考。

不建议照搬：

- Cloudflare Workers、KV、Follow API、Gemini 绑定不适合直接迁入当前 Next.js + Prisma 架构。
- 不要复制其云平台依赖和环境变量组织方式。

LongyuChat 落点：

- 学栏目结构和页面表达，不学基础设施。
- 可把当前 DailyIssue/DailyIssueItem 扩展成更稳定的“头版 + 栏目 + 来源证据”输出。

### 3. Horizon

- 项目：https://github.com/Thysrael/Horizon
- Demo：https://thysrael.github.io/Horizon/
- 定位：AI powered news radar，生成中英文日报。

可借鉴点：

- 管线完整：多源抓取、去重、AI 打分、筛选、背景解释、摘要、发布。
- 来源类型丰富：Hacker News、Reddit、Telegram、RSS、Twitter/X、GitHub Release 和用户动态。
- 强调“背景解释”和“社区讨论”，能提升日报的可读性和判断价值。

不建议照搬：

- 第一阶段不要引入过多来源和社区 enrich 逻辑，容易拖慢稳定化。
- 不要在当前阶段做过重的个性化 newsroom。

LongyuChat 落点：

- 作为 v2 质量管线参考：先稳定 RSS/GitHub/HN 等结构化源，再逐步加 enrich。
- AI 打分结果应落库，方便后台解释“为什么入选/为什么淘汰”。

### 4. YeeKal/ai-daily

- 项目：https://github.com/YeeKal/ai-daily
- 定位：RSS 新闻聚合、LLM 打分、热点即时推送、每日摘要。

可借鉴点：

- 运行策略务实：固定 RSS 源、LLM 评分、热度阈值、早晚日报。
- `fetch_lookback` 机制能减少 RSS 延迟导致的漏抓。
- “hot immediate push”和“daily digest”分离，适合未来扩展，但不必现在实现推送。

不建议照搬：

- Discord/Feishu 推送不是 LongyuChat 当前主线。
- 400+ RSS 源会带来噪声和维护成本，当前不宜追求数量。

LongyuChat 落点：

- scan 阶段加入 lookback 思路，避免只按本次时间窗口抓取而漏掉延迟发布的 RSS。
- publish 阶段引入最小候选阈值和质量阈值，避免低质量日报自动发布。

## 第二梯队：局部能力值得学习

### 5. SuYxh/ai-news-aggregator

- 项目：https://github.com/SuYxh/ai-news-aggregator
- Demo：https://suyxh.github.io/ai-news-aggregator/
- 定位：AI/科技资讯聚合站，GitHub Actions 定时生成静态数据。

可借鉴点：

- `source-status`、标题中文缓存、24h/7d/archive 数据快照很适合后台排障和归档。
- 英文标题中文化的缓存策略可以降低重复 LLM 成本。
- 前端列表、归档和来源状态比纯 Markdown 日报更利于排查。

不建议照搬：

- 它更像新闻列表站，不是完整的中文日报编辑系统。
- 不要把 LongyuChat 变成只展示 JSON 列表的聚合站。

LongyuChat 落点：

- 后台增加 source health 和 title cache 视角。
- 日报归档页可参考“时间窗口 + 来源状态 + 搜索”的体验。

### 6. TrendRadar

- 项目：https://github.com/sansan0/TrendRadar
- 定位：AI 驱动的热点舆情监控和趋势雷达。

可借鉴点：

- 运行记录、来源状态、rank history、AI filter cache 值得学习。
- 关键词配置支持分组、别名、排除词、正则和最低数量，适合构建兴趣配置。
- 分阶段运行模型适合后台展示：collect -> analyze -> push/publish。

不建议照搬：

- 它是通用热点监控，不是专门的 AI 日报。
- 多通知渠道、MCP、复杂 timeline preset 和 GitHub Actions 试用机制都不适合当前阶段。
- 默认依赖外部热榜聚合源，长期稳定性要谨慎评估。

LongyuChat 落点：

- DailyRun/DailyRunStep 应清楚记录每阶段输入数、输出数、失败数、耗时和错误。
- 后台优先做“为什么今天没发/为什么某来源失败/为什么某条没入选”的排查能力。

### 7. agents-radar

- 项目：https://github.com/duanyytop/agents-radar
- Demo：https://duanyytop.github.io/agents-radar/
- 定位：每天抓取 AI 生态信号，生成中英双语日报、周报和月报。

可借鉴点：

- 来源选择很贴合 AI 生态：GitHub、ArXiv、Hacker News、HuggingFace、Product Hunt、Dev.to、Lobste.rs、OpenAI/Anthropic sitemap。
- GitHub Issues + Markdown + RSS + Web UI 的发布链路简单直接。
- 每日、每周、每月 rollup 可以作为未来扩展方向。

不建议照搬：

- MCP server、Telegram、Feishu 都不是 LongyuChat 当前优先级。
- 不要把“Agent 生态雷达”范围直接等同于 LongyuChat 的 AI 全领域日报。

LongyuChat 落点：

- 可参考其来源集合，先挑结构化且稳定的 5-8 个源。
- RSS 和历史归档可以保持简单，不必一开始做 MCP。

### 8. hf-daily-paper-newsletter-chinese

- 项目：https://github.com/2404589803/hf-daily-paper-newsletter-chinese
- 定位：HuggingFace Daily Papers 中文解读和 newsletter。

可借鉴点：

- 适合作为“论文解读”栏目参考。
- 论文趋势、统计、关键词和中文解释有助于提升专业感。

不建议照搬：

- 它是论文日报，不是综合 AI 日报。
- 图片、词云、音频等生成能力暂时不是 LongyuChat 主线。

LongyuChat 落点：

- 论文栏目可以先从 HuggingFace Daily Papers 或 arXiv RSS 做小规模试点。
- 每篇论文必须保留 paper URL、摘要来源和发布时间。

### 9. geekjourneyx/ai-daily-skill

- 项目：https://github.com/geekjourneyx/ai-daily-skill
- 定位：Claude Code AI 日报 skill。

可借鉴点：

- Agent 交互说明清楚，适合学习“如何让 Agent 查询日报”。
- 单一 curated source 的兜底体验简单稳定。

不建议照搬：

- 单源 `news.smol.ai` 不足以支撑 LongyuChat 的公开日报。
- 它是 skill，不是站内生产管线。

LongyuChat 落点：

- 等公共 API 稳定后，再为 LongyuChat 做 Codex/Claude skill。

## 第三梯队：来源发现和边界参考

### newsnow

- 项目：https://github.com/ourongxing/newsnow
- 定位：实时热点新闻聚合阅读。

可借鉴点：

- 可作为热点聚合源参考，尤其适合快速补充中文热榜。

风险：

- 它不是日报生成系统，且依赖第三方聚合服务时要考虑稳定性和来源可追溯。

### finaldie/auto-news

- 项目：https://github.com/finaldie/auto-news
- 定位：多源个人信息聚合 + LLM，总线偏重 Notion、LangChain、Airflow/Kubernetes。

可借鉴点：

- “过滤噪声、周期性 recap、个人知识流”思路有启发。

风险：

- 架构过重，不适合 LongyuChat 当前阶段。

### newsletter/source list

- https://github.com/alternbits/awesome-ai-newsletters
- https://github.com/aitools-coffee/Open-Source-AI-News
- https://github.com/taielab/awesome-ai-news

可借鉴点：

- 适合补充来源池和人工校验来源质量。

风险：

- 这些是清单，不是运行系统。不能替代 scan/publish pipeline。

## 对 LongyuChat 的下一步建议

按风险和收益排序：

1. 先确认 Prisma schema 和 migrations 与 `docs/ai-daily-technical-handoff.md` 一致。
2. 补 scan/publish pipeline 的最小自动化测试，覆盖成功发布、无候选不发布、来源失败可记录、模型失败可回滚或停在明确状态。
3. 确认生产自动化里的 `daily:seed-defaults` 不会被 bearer token 或后台鉴权拦住。
4. 增强 DailyRun/DailyRunStep：记录每阶段数量、耗时、错误、跳过原因。
5. 优化中文头版：日报标题单独生成，顶部包括主标题、导语、今日 3-5 个最重要信号。
6. 强化来源证据：DailyIssueItemSource 必须能展示 source name、URL、publishedAt/fetchedAt。
7. 后台优先做排障体验：最近运行、失败来源、候选池、最终入选、发布日志。
8. 稳定后再开放 public API、RSS 优化和 Agent skill。

## 当前明确不做

- 不迁移到 Cloudflare Workers。
- 不引入 MCP server。
- 不接多平台推送。
- 不一次性扩到数百个 RSS 源。
- 不做个性化推荐。
- 不让日报模块绕过 LongyuChat 现有模型配置。
