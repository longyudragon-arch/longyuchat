# AI 日报架构草案

## 1. 目标

在 `LongyuChat` 现有主站中新增一个 `全自动 AI 日报` 模块：

- 自动抓取多个来源
- 自动去重和聚类
- 自动打分和筛选
- 自动生成日报内容
- 自动发布到主站
- 自动生成 RSS

不包含视频制作链路。

## 2. 推荐架构

建议分成两个运行面：

### 2.1 Web App

由现有 `LongyuChat` Next.js 项目承担：

- 日报首页 `/daily`
- 单期详情页 `/daily/[slug]`
- 历史归档页 `/daily/archive`
- 首页日报入口区块
- RSS 输出
- 后台管理页面

### 2.2 Daily Worker

单独的异步任务执行面：

- 定时抓取来源
- 规范化原始内容
- 去重
- 聚类
- AI 打分
- AI 摘要与成稿
- 自动发布到数据库

这个 worker 可以放在当前仓库内，但不应直接耦合到前台页面请求里。

## 3. 模块边界

推荐目录形态：

```text
ai-daily/
  README.md
  ARCHITECTURE.md
  ROADMAP.md
  API-STRATEGY.md
  worker/
  prompts/
```

推荐主站内的承载目录：

```text
app/
  daily/
  admin/daily/

server/
  services/daily-issue-service.ts
  services/daily-feed-service.ts
  services/daily-publish-service.ts
  services/daily-source-service.ts
```

## 4. 数据流

### 4.1 小时级扫描

每 1 到 2 小时执行一次：

1. 拉取来源
2. 生成原始 source items
3. 规范化 URL / 标题 / 发布时间
4. 去重
5. 聚类成 story clusters
6. 对 cluster 打分

### 4.2 每日发布

每天固定时间执行一次：

1. 读取过去 24 小时高分 clusters
2. 过滤低价值内容
3. 生成日报标题、导语和条目
4. 写入 `daily_issues` 与 `daily_issue_items`
5. 自动发布
6. 更新 RSS

## 5. 推荐数据层级

至少拆成 3 层：

### 5.1 原始来源层

`daily_source_items`

用于保存抓取回来的原始材料：

- source type
- source name
- canonical url
- raw title
- raw summary/content
- published at
- fetched at
- metadata

### 5.2 事件聚类层

`daily_story_clusters`

用于保存已经被去重和聚类后的“事件”：

- cluster key
- primary url
- primary title
- score
- tags
- selected / rejected state

### 5.3 发布层

`daily_issues`
`daily_issue_items`

用于保存面向网站和 RSS 的最终内容。

## 6. 来源策略

第一阶段优先这些来源：

- 官方博客
- GitHub Releases / GitHub 相关动态
- Hacker News
- Reddit 指定版块
- 原生 RSS
- 经 RSSHub 转换后的来源

第一阶段不建议把 X 和微信公众号采集做成主依赖。

## 7. 推荐组合

### 主引擎

优先参考 / 复用：

- `Horizon`

### 来源扩展层

直接部署：

- `RSSHub`

### 只参考，不直接并入

- `juya-ai-daily`
- `openclaw-newsroom`
- `auto-news`
- `zenfeed`

## 8. 架构原则

- 读取和写入分离
- 页面层只读数据库，不直接调用抓取或 LLM
- 自动发布要有最低质量阈值
- 每条日报条目必须可回溯到来源
- 同一事件优先官方源
- 保留重生成能力，不把一次生成当成唯一真相
