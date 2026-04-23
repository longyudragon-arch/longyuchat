# LongyuChat AI 日报

这个目录用于承载 `LongyuChat` 里的 `AI 日报` 子项目。

当前阶段先不落具体实现代码，先固定方向、架构和约束，避免后面一边做一边推翻。

## 当前定位

- 这是 `LongyuChat` 总站中的一个独立模块
- 目标是做成 `全自动 AI 日报`
- 不做视频版
- 最终发布面仍然是 `LongyuChat` 主站，而不是单独再起一个对外站点

## 已确认的核心决策

- `LongyuChat` 负责最终展示、归档、RSS、SEO 和首页入口
- `AI 日报 worker` 负责抓取、评分、去重、聚类、摘要和自动发布
- 来源优先采用结构化数据源，避免第一阶段就重度依赖脆弱爬虫
- 发布流程走 `异步生成 -> 写库 -> 前台读取`，不在页面请求里直接跑 LLM

## 推荐技术组合

- `RSSHub`：补齐非原生 RSS 来源
- `Horizon`：作为自动日报引擎的主要参考对象
- `LongyuChat`：作为最终发布层
- `juya-ai-daily`：参考其 Markdown / RSS / 归档形态
- `openclaw-newsroom`：参考其自动化采编策略

## 当前不做

- 视频版
- 多平台同步发布
- 个性化推荐
- 评论系统
- 搜索系统
- 多作者后台

## 文档索引

- [ARCHITECTURE.md](./ARCHITECTURE.md)：架构、模块边界、数据流
- [ROADMAP.md](./ROADMAP.md)：阶段划分与实施顺序
- [API-STRATEGY.md](./API-STRATEGY.md)：大模型 API、成本与提供商策略
- [SYSTEM-DESIGN.md](./SYSTEM-DESIGN.md)：表设计、目录结构、调度方案
- [PRISMA-SCHEMA-DRAFT.prisma](./PRISMA-SCHEMA-DRAFT.prisma)：可并入主项目的 Prisma 草案
