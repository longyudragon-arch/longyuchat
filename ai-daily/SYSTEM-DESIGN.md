# LongyuChat AI 日报详细设计

本文补充 `LongyuChat` 中 `AI 日报` 模块的三部分设计：

- 数据表设计
- 目录结构设计
- 调度方案设计

当前假设：

- 日报是 `LongyuChat` 总站中的独立模块
- 目标是 `全自动日报`
- 不做视频版
- 第一阶段优先结构化来源，不依赖重爬虫
- 第一阶段仍以单机部署为主，优先兼容当前 `Next.js + Prisma + SQLite`

---

## 1. 数据表设计

建议把数据拆成 4 层：

1. 原始来源层：保存抓取结果
2. 聚类层：保存去重后的事件
3. 发布层：保存已生成日报
4. 运行层：保存调度与执行记录

### 1.1 原始来源层

#### `daily_sources`

用途：保存可被 worker 轮询的来源定义。

建议字段：

- `id`
- `name`
- `kind`
  - 枚举：`RSS` / `GITHUB_RELEASES` / `GITHUB_REPO_EVENTS` / `HACKERNEWS` / `REDDIT` / `WEB_FEED`
- `base_url`
- `feed_url`
- `config_json`
- `enabled`
- `priority`
- `created_at`
- `updated_at`
- `last_fetched_at`

约束建议：

- `name` 唯一
- `priority` 越小越优先
- `enabled = false` 时调度器跳过

#### `daily_source_items`

用途：保存抓取到的原始内容，不做最终展示。

建议字段：

- `id`
- `source_id`
- `external_id`
- `canonical_url`
- `title`
- `author`
- `published_at`
- `fetched_at`
- `language`
- `content_text`
- `content_html`
- `summary_raw`
- `meta_json`
- `content_hash`

约束建议：

- `source_id + external_id` 唯一
- `canonical_url` 建索引
- `content_hash` 建索引
- 原始内容不直接参与前台渲染

用途说明：

- 保证未来可以重新聚类、重新打分、重新生成日报
- 不把一次 LLM 结果当成唯一真相

### 1.2 聚类层

#### `daily_story_clusters`

用途：把多个来源对同一事件的报道聚合为一个“事件簇”。

建议字段：

- `id`
- `cluster_key`
- `canonical_url`
- `primary_source_item_id`
- `title`
- `published_at`
- `score`
- `status`
  - 枚举：`PENDING` / `SELECTED` / `REJECTED`
- `tags_json`
- `summary_draft`
- `editorial_reason`
- `created_at`
- `updated_at`

约束建议：

- `cluster_key` 唯一
- `score` 建索引
- `status + published_at` 建索引

#### `daily_story_cluster_items`

用途：保存 cluster 与原始来源项的关系。

建议字段：

- `id`
- `cluster_id`
- `source_item_id`
- `is_primary`
- `sort_order`
- `created_at`

约束建议：

- `cluster_id + source_item_id` 唯一
- 一个 cluster 至少有 1 个 source item

### 1.3 发布层

#### `daily_issues`

用途：保存最终发布到网站的一期日报。

建议字段：

- `id`
- `issue_date`
- `slug`
- `title`
- `summary`
- `cover_image_url`
- `status`
  - 枚举：`DRAFT` / `PUBLISHED` / `SKIPPED`
- `published_at`
- `source_window_start`
- `source_window_end`
- `meta_json`
- `created_at`
- `updated_at`

约束建议：

- `issue_date` 唯一
- `slug` 唯一
- 每天最多 1 期正式日报

#### `daily_issue_items`

用途：保存某一期日报中的条目。

建议字段：

- `id`
- `issue_id`
- `cluster_id`
- `title`
- `summary`
- `content`
- `source_url`
- `source_name`
- `tags_json`
- `sort_order`
- `is_featured`
- `created_at`
- `updated_at`

约束建议：

- `issue_id + sort_order` 唯一
- `issue_id + cluster_id` 唯一

### 1.4 运行层

#### `daily_runs`

用途：保存调度执行记录，便于排障和重跑。

建议字段：

- `id`
- `run_type`
  - 枚举：`SCAN` / `PUBLISH`
- `status`
  - 枚举：`RUNNING` / `SUCCESS` / `FAILED`
- `started_at`
- `finished_at`
- `summary`
- `error_message`
- `stats_json`
- `created_at`

#### `daily_run_steps`

用途：保存一次运行中的细分步骤。

建议字段：

- `id`
- `run_id`
- `step_name`
- `status`
- `started_at`
- `finished_at`
- `message`
- `payload_json`

这样做的目的：

- 调试抓取失败
- 调试 LLM 输出异常
- 统计每次跑稿的来源数、过滤数、入选数

---

## 2. 推荐 Prisma 映射策略

当前 `LongyuChat` 已经采用：

- Prisma model 用 PascalCase
- 实际表名用 `@@map("snake_case")`

日报模块建议延续同样风格。

示例：

- `DailySource` -> `daily_sources`
- `DailySourceItem` -> `daily_source_items`
- `DailyStoryCluster` -> `daily_story_clusters`
- `DailyStoryClusterItem` -> `daily_story_cluster_items`
- `DailyIssue` -> `daily_issues`
- `DailyIssueItem` -> `daily_issue_items`
- `DailyRun` -> `daily_runs`
- `DailyRunStep` -> `daily_run_steps`

---

## 3. 目录结构设计

推荐拆成两个部分：

### 3.1 主站部分

```text
app/
  daily/
    page.tsx
    archive/
      page.tsx
    [slug]/
      page.tsx
  admin/
    daily/
      page.tsx
      [id]/
        page.tsx

components/
  daily/
    daily-hero.tsx
    daily-issue-list.tsx
    daily-issue-card.tsx
    daily-issue-item.tsx
    daily-archive-list.tsx
    admin-daily-run-panel.tsx
    admin-daily-issue-editor.tsx

server/
  services/
    daily-issue-service.ts
    daily-feed-service.ts
    daily-run-service.ts
    daily-admin-service.ts

types/
  daily.ts
```

职责：

- `app/daily`：公开页面
- `app/admin/daily`：后台管理页
- `components/daily`：日报 UI
- `server/services`：查询与发布逻辑
- `types/daily.ts`：共享类型

### 3.2 Worker 部分

建议放在仓库根目录下单独隔离：

```text
ai-daily/
  README.md
  ARCHITECTURE.md
  ROADMAP.md
  API-STRATEGY.md
  SYSTEM-DESIGN.md
  worker/
    sources/
      fetch-rss.ts
      fetch-github.ts
      fetch-hackernews.ts
      fetch-reddit.ts
    pipeline/
      normalize.ts
      deduplicate.ts
      cluster.ts
      score.ts
      summarize.ts
      publish.ts
    runtime/
      env.ts
      logger.ts
      database.ts
    jobs/
      scan-job.ts
      publish-job.ts
    prompts/
      score.prompt.md
      summarize.prompt.md
      daily-editor.prompt.md
    index.ts
```

职责：

- `sources/`：各类来源适配器
- `pipeline/`：内容处理主链路
- `runtime/`：配置、日志、数据库访问
- `jobs/`：调度入口
- `prompts/`：日报 worker 专用提示词

### 3.3 为什么不要直接把 worker 塞进 `app/api`

因为 worker 的执行特征与页面请求不同：

- 耗时长
- 涉及并发抓取
- 涉及大量 LLM 请求
- 需要可重试
- 需要有运行日志

所以更合理的是：

- `页面/API` 负责读
- `worker/jobs` 负责写

---

## 4. 调度方案

推荐调度拆成两个周期：

### 4.1 扫描调度

频率：

- 每 1 小时或每 2 小时一次

执行内容：

1. 拉取所有启用来源
2. 写入 `daily_source_items`
3. 规范化
4. 去重
5. 聚类
6. 打分
7. 更新 `daily_story_clusters`

推荐命令：

- `npm run daily:scan`

### 4.2 发布调度

频率：

- 每天固定一次，比如早上 08:00 或 09:00

执行内容：

1. 取最近 24 小时高分 cluster
2. 判断是否达到发布阈值
3. 生成标题、导语和各条内容
4. 写入 `daily_issues`
5. 写入 `daily_issue_items`
6. 标记 `PUBLISHED`
7. 更新 RSS

推荐命令：

- `npm run daily:publish`

### 4.3 可选补充调度

#### `daily:rebuild-rss`

用途：

- 当日报数据已在库里，但 RSS 需要重建时使用

#### `daily:republish --date=YYYY-MM-DD`

用途：

- 重新生成某一天日报

#### `daily:backfill --hours=48`

用途：

- 补抓最近一段时间来源

---

## 5. 调度实现建议

当前最适合你的方式是：

### 方案 A：服务器 cron

优点：

- 与主站同部署环境
- 成本低
- 可控
- 最适合单机 Next.js + Prisma 项目

推荐配置：

- `0 */2 * * *` 跑 `daily:scan`
- `0 8 * * *` 跑 `daily:publish`

### 方案 B：GitHub Actions

优点：

- 容易上手
- 适合纯静态产出

缺点：

- 如果要直接写你主站数据库，不如服务器 cron 顺手
- 调试和密钥管理更分散

### 方案 C：站内 heartbeat / automation

只适合轻量唤醒，不建议当最终生产调度主方案。

### 当前推荐

优先：

- **服务器 cron + 本地 worker 命令**

理由：

- 最贴合你当前仓库形态
- 最容易接 Prisma 数据库
- 不会把日报调度和 GitHub Pages 绑定死

---

## 6. 发布阈值建议

全自动路线必须加阈值，否则很容易发出质量差的日报。

建议规则：

- 当日入选 cluster 数 < 3：跳过发布或发布短版
- 单一来源且可信度低：不入选
- 同一事件多来源时优先官方源
- cluster 分数低于阈值：不进入最终日报

建议保留：

- `DRAFT`
- `PUBLISHED`
- `SKIPPED`

这样即使没发，也能留下当日记录。

---

## 7. 推荐实施顺序

### 第一步

先加 Prisma 表，但不做页面。

### 第二步

先做 `daily:scan`，把来源抓取、去重、聚类跑通。

### 第三步

再做 `daily:publish`，把最终日报写库。

### 第四步

最后做 `/daily`、详情页、归档页和首页入口。

这个顺序的好处：

- 先证明自动化引擎可行
- 再做前台展示
- 不会出现页面写好了但后台没内容的空壳情况

---

## 8. 当前最终建议

就 `LongyuChat` 而言，最稳的落地方案是：

- 主站继续保持 `Next.js + Prisma`
- AI 日报作为独立模块新增页面和表
- 日报 worker 放在 `ai-daily/worker`
- 调度优先用服务器 cron
- 来源优先结构化数据源
- 自动发布必须带质量阈值

这套方案兼容你当前项目，也方便以后继续扩成：

- 周报
- 专题
- GitHub 项目推荐
- AI 资源推荐
