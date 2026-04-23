# Provider Connections / 模型接入改造交接

更新日期：2026-03-26  
当前工作分支：`codex/provider-connections-phase1`

## 1. 这次改造的目标

这轮工作不是在重写聊天主链路，而是在现有 MVP 上，为“模型接入”补一层更成熟的结构：

- 让“Provider 连接”成为一等对象
- 把“连接测试”和“模型发现”拆开
- 给不同平台模板、官方入口、默认 Base URL、自动发现策略留统一出口
- 同时保留旧的“直接创建模型”路径，避免一次性推翻现有模型页

当前状态可以理解为：

- 后端的 `Provider Connection` 能力已经落地
- 前端模型页已经部分接上，但交互仍未定型
- 现在处于“连接优先能力已具备，产品交互还在收口”的阶段

## 2. 已经做完的核心改动

### 2.1 数据层

在 `prisma/schema.prisma` 中新增了 `ProviderConnection` 模型，并给 `ModelConfig` 增加了可选的 `connectionId`：

- `ProviderConnection`
  - `id`
  - `name`
  - `provider`
  - `baseUrl`
  - `apiKey`
  - `discoveryStrategy`
  - `enabled`
  - `lastAuthStatus`
  - `lastAuthMessage`
  - `lastAuthCheckedAt`
  - `lastDiscoveryStatus`
  - `lastDiscoveryMessage`
  - `lastDiscoveredAt`
  - `createdAt`
  - `updatedAt`

- `ModelConfig`
  - 新增可选 `connectionId`
  - 删除连接时采用 `SetNull`，不会偷偷删模型

相关文件：

- [C:\longyuchat\prisma\schema.prisma](C:/longyuchat/prisma/schema.prisma)
- [C:\longyuchat\prisma\migrations\20260325110000_add_provider_connections\migration.sql](C:/longyuchat/prisma/migrations/20260325110000_add_provider_connections/migration.sql)

### 2.2 新增连接层服务

新增了 `provider connection` 服务层，负责：

- 创建连接
- 读取连接
- 更新连接
- 删除连接
- 测试连接
- 按连接发现模型

关键行为：

- 连接 API Key 走服务端存储
- 生产模式下必须配置 `MODEL_SECRET_ENCRYPTION_KEY`
- 删除连接前会检查是否已有模型引用它
- 若模型仍引用该连接，删除会返回 `409`

相关文件：

- [C:\longyuchat\server\services\provider-connection-service.ts](C:/longyuchat/server/services/provider-connection-service.ts)
- [C:\longyuchat\server\services\model-config-service.ts](C:/longyuchat/server/services/model-config-service.ts)
- [C:\longyuchat\server\services\model-discovery-service.ts](C:/longyuchat/server/services/model-discovery-service.ts)

### 2.3 新增 Provider Catalog

为了不让前端长期维护一份硬编码模板，这轮加了 `provider catalog`：

- 后端只读接口：`/api/provider-catalog`
- 前端优先从接口读取模板，失败时才退回本地 fallback

当前 catalog 里已经放了两类内容：

- 通用 provider 选项
- 平台模板元数据
  - `name`
  - `subtitle`
  - `provider`
  - `suggestedBaseUrl`
  - `defaultModelName`
  - `preferredDiscoveryStrategy`
  - `officialUrl`
  - `apiKeyUrl`
  - `docsUrl`
  - `modelsUrl`
  - `note`

相关文件：

- [C:\longyuchat\lib\provider-catalog.ts](C:/longyuchat/lib/provider-catalog.ts)
- [C:\longyuchat\server\services\provider-catalog-service.ts](C:/longyuchat/server/services/provider-catalog-service.ts)
- [C:\longyuchat\app\api\provider-catalog\route.ts](C:/longyuchat/app/api/provider-catalog/route.ts)

### 2.4 新增连接相关 API

已经新增的 API：

- `GET /api/provider-connections`
- `POST /api/provider-connections`
- `GET /api/provider-connections/:id`
- `PUT /api/provider-connections/:id`
- `DELETE /api/provider-connections/:id`
- `POST /api/provider-connections/:id/test`
- `POST /api/provider-connections/:id/discover-models`
- `GET /api/provider-catalog`

相关文件：

- [C:\longyuchat\app\api\provider-connections\route.ts](C:/longyuchat/app/api/provider-connections/route.ts)
- [C:\longyuchat\app\api\provider-connections\[id]\route.ts](C:/longyuchat/app/api/provider-connections/[id]/route.ts)
- [C:\longyuchat\app\api\provider-connections\[id]\test\route.ts](C:/longyuchat/app/api/provider-connections/[id]/test/route.ts)
- [C:\longyuchat\app\api\provider-connections\[id]\discover-models\route.ts](C:/longyuchat/app/api/provider-connections/[id]/discover-models/route.ts)
- [C:\longyuchat\app\api\provider-catalog\route.ts](C:/longyuchat/app/api/provider-catalog/route.ts)

### 2.5 旧模型 API 已支持连接模式

旧的模型创建接口没有被删掉，但现在已经支持：

- 直接创建模型：提交 `provider + baseUrl + apiKey + modelName`
- 基于连接创建模型：提交 `connectionId + modelName`

服务层逻辑：

- 若传 `connectionId`，模型会继承连接上的 `provider / baseUrl / apiKey`
- 若不传 `connectionId`，仍按旧模式处理

相关文件：

- [C:\longyuchat\app\api\models\route.ts](C:/longyuchat/app/api/models/route.ts)
- [C:\longyuchat\app\api\models\[id]\route.ts](C:/longyuchat/app/api/models/[id]/route.ts)
- [C:\longyuchat\server\services\model-config-service.ts](C:/longyuchat/server/services/model-config-service.ts)

### 2.6 前端 client 层已经接好

前端请求层已补齐连接相关方法：

- `fetchProviderConnectionsRequest`
- `fetchProviderConnectionByIdRequest`
- `createProviderConnectionRequest`
- `updateProviderConnectionRequest`
- `deleteProviderConnectionRequest`
- `testProviderConnectionRequest`
- `discoverProviderModelsByConnectionRequest`
- `fetchProviderCatalogRequest`

相关文件：

- [C:\longyuchat\lib\client\longyuchat-client.ts](C:/longyuchat/lib/client/longyuchat-client.ts)
- [C:\longyuchat\types\app.ts](C:/longyuchat/types/app.ts)

## 3. 已经验证过的行为

### 3.1 BigModel / 智谱模板

针对智谱，当前模板已经改成：

- `provider = OPENAI_COMPATIBLE`
- `suggestedBaseUrl = https://open.bigmodel.cn/api/paas/v4`
- `preferredDiscoveryStrategy = AUTO_FETCH_WITH_MANUAL_FALLBACK`

相关模板文件：

- [C:\longyuchat\lib\provider-catalog.ts](C:/longyuchat/lib/provider-catalog.ts)

这个改动的出发点是：

- 先按 OpenAI-compatible 路径尝试自动获取模型
- 如果平台实际没有提供兼容的 `/models` 列表，再手动填写模型 ID

### 3.2 本地测试过的关键事实

本地已验证过：

- `/api/provider-catalog` 能返回模板列表
- `/api/provider-connections` 在本地有正确环境变量时可创建连接
- 使用 BigModel URL 创建连接返回 `201`
- `provider = OPENAI_COMPATIBLE`
- `baseUrl = https://open.bigmodel.cn/api/paas/v4`

### 3.3 自动化验证

这轮新增/修改的测试主要集中在：

- `provider connection` 服务
- `model config` 服务
- 前端 client 层
- presenter 层

相关测试文件：

- [C:\longyuchat\tests\provider-connection-service.test.ts](C:/longyuchat/tests/provider-connection-service.test.ts)
- [C:\longyuchat\tests\model-config-service.test.ts](C:/longyuchat/tests/model-config-service.test.ts)
- [C:\longyuchat\tests\longyuchat-client.test.ts](C:/longyuchat/tests/longyuchat-client.test.ts)
- [C:\longyuchat\tests\api-presenters.test.ts](C:/longyuchat/tests/api-presenters.test.ts)

## 4. 当前前端状态

### 4.1 模型页已经接了新能力，但交互仍未收口

当前模型页的核心文件是：

- [C:\longyuchat\components\models-page.tsx](C:/longyuchat/components/models-page.tsx)

这部分已经做过多轮迭代，目前的状态是：

- 后端新能力已经能被前端调用
- 页面支持：
  - 直接创建模型
  - 基于已保存连接创建模型
  - 从 catalog 读取 provider 模板
- 但用户反馈很明确：
  - 现在的模型页仍然容易让人困惑
  - “先建连接再建模型”的心智太重
  - 更想要接近旧版那种“一步填写并创建模型”的体验

### 4.2 当前用户偏好的操作心智

用户实际想要的主路径是：

1. 选提供商
2. 自动带出 Base URL
3. 填 API Key
4. 如果支持，就点“获取列表”
5. 否则手动填模型 ID
6. 直接创建模型

也就是说：

- `Provider Connection` 可以存在
- 但它更适合做可选增强能力
- 不适合在当前模型页里压过“直接建模型”主流程

### 4.3 当前前端已做过的一些补救

目前模型页里已经做过这些调整：

- 默认主模式改回“直接建模型”
- 保存连接变成可选，而不是强制第一步
- 若“显示名称”为空，自动用 `modelName` 兜底
- “立即启用此模型”文案已经收成“创建后立即启用”
- 平台模板已经尽量并入提供商选择逻辑

但整体上仍然需要进一步收口。

## 5. 当前明确存在的问题 / 需要继续调整的地方

### 5.1 第一优先级：模型页交互继续简化

这是当前最重要的待办。

建议方向：

- 把“直接创建模型”作为唯一主路径
- 把“保存连接”降级成：
  - 二级入口
  - 或折叠面板
  - 或单独子区块
- 页面一进来就让人看到：
  - 提供商
  - Base URL
  - API Key
  - 获取模型列表
  - 模型 ID
  - 创建模型

不要再让“连接来源”“两步流程”“保存连接优先”等心智压过主流程。

### 5.2 第二优先级：模板与 discovery 策略还需要继续校准

当前 catalog 已经存在，但不是所有平台都经过真实验证。

当前已知情况：

- `autoDiscoverableProviders` 仍是一个相对保守的白名单
- 某些平台模板虽然被设成 `AUTO_FETCH_WITH_MANUAL_FALLBACK`
- 但它们是否真的支持兼容 `/models`，还需要逐个平台验证

当前最该继续盯的是：

- 智谱 BigModel
- Moonshot
- MiniMax
- Spark
- Hunyuan
- DashScope
- SiliconFlow
- OpenRouter
- GitHub Models

### 5.3 第三优先级：前后端仍处在“混合阶段”

现在是：

- 连接模式已经有了
- 直接建模模式也还保留

这是合理的过渡态，但接手的人需要明确：

- 当前不是已经完成的最终架构
- 而是 phase 1 / phase 1.5
- 下一步需要决定：
  - 长期保持 hybrid
  - 还是最终把“连接管理”和“模型管理”更清晰地拆开

我个人更建议：

- 保留 hybrid
- 但把“直接建模型”做成默认主流程
- “连接管理”做成增强能力

### 5.4 第四优先级：错误提示和空状态还要继续打磨

当前已经做了一部分，但还不够顺。

建议补的点：

- 获取模型失败时，要明确区分：
  - 平台不支持自动发现
  - 连接成功但没返回模型列表
  - 认证失败
  - 429 / 配额限制
- 模板说明应尽量简短
- 不要让页面上方堆太多说明卡影响主要表单

## 6. 本地环境与调试注意事项

### 6.1 本地如果用 `next start`，需要加密密钥

本地曾经出现过一个容易误判的问题：

- `POST /api/provider-connections` 返回 `500`

真实原因不是代码逻辑错，而是：

- 本地当时跑的是 `next start`
- 但没有配置 `MODEL_SECRET_ENCRYPTION_KEY`

实际报错是：

- `MODEL_SECRET_ENCRYPTION_KEY must be configured in production to store provider API keys.`

因此接手时要注意：

- 如果本地跑生产模式，需配置：
  - [C:\longyuchat\.env.local](C:/longyuchat/.env.local)
- 否则连接创建会直接 500

### 6.2 本地 dev 链路一度不稳定

本地曾遇到过：

- `next dev` 挂住
- 首页能开，但其他页面一直转圈
- 或 `ERR_CONNECTION_REFUSED`

为保证本地可测，当时加过一些本地启动脚本：

- [C:\longyuchat\.codex\start-dev-local.ps1](C:/longyuchat/.codex/start-dev-local.ps1)
- [C:\longyuchat\.codex\start-local-start.ps1](C:/longyuchat/.codex/start-local-start.ps1)

这些属于本地辅助，不是产品逻辑的一部分。

## 7. 当前工作区里哪些东西和这个功能无关

接手时建议忽略这些本地噪音：

- [C:\longyuchat\.codex](C:/longyuchat/.codex)
- [C:\longyuchat\stitch_handoff](C:/longyuchat/stitch_handoff)
- [C:\longyuchat\stitch_new_project](C:/longyuchat/stitch_new_project)
- [C:\longyuchat\_stitch_export](C:/longyuchat/_stitch_export)
- [C:\longyuchat\var\log](C:/longyuchat/var/log)
- [C:\longyuchat\.agents](C:/longyuchat/.agents)

这些不是 provider connection 功能的核心实现。

## 8. 这轮功能涉及的核心文件总表

### 数据层

- [C:\longyuchat\prisma\schema.prisma](C:/longyuchat/prisma/schema.prisma)
- [C:\longyuchat\prisma\migrations\20260325110000_add_provider_connections\migration.sql](C:/longyuchat/prisma/migrations/20260325110000_add_provider_connections/migration.sql)

### 类型与前端请求层

- [C:\longyuchat\types\app.ts](C:/longyuchat/types/app.ts)
- [C:\longyuchat\lib\provider-catalog.ts](C:/longyuchat/lib/provider-catalog.ts)
- [C:\longyuchat\lib\client\longyuchat-client.ts](C:/longyuchat/lib/client/longyuchat-client.ts)

### 服务层

- [C:\longyuchat\server\services\provider-connection-service.ts](C:/longyuchat/server/services/provider-connection-service.ts)
- [C:\longyuchat\server\services\provider-catalog-service.ts](C:/longyuchat/server/services/provider-catalog-service.ts)
- [C:\longyuchat\server\services\model-config-service.ts](C:/longyuchat/server/services/model-config-service.ts)
- [C:\longyuchat\server\services\model-discovery-service.ts](C:/longyuchat/server/services/model-discovery-service.ts)
- [C:\longyuchat\server\presenters\api-presenters.ts](C:/longyuchat/server/presenters/api-presenters.ts)

### API Route

- [C:\longyuchat\app\api\provider-catalog\route.ts](C:/longyuchat/app/api/provider-catalog/route.ts)
- [C:\longyuchat\app\api\provider-connections\route.ts](C:/longyuchat/app/api/provider-connections/route.ts)
- [C:\longyuchat\app\api\provider-connections\[id]\route.ts](C:/longyuchat/app/api/provider-connections/[id]/route.ts)
- [C:\longyuchat\app\api\provider-connections\[id]\test\route.ts](C:/longyuchat/app/api/provider-connections/[id]/test/route.ts)
- [C:\longyuchat\app\api\provider-connections\[id]\discover-models\route.ts](C:/longyuchat/app/api/provider-connections/[id]/discover-models/route.ts)
- [C:\longyuchat\app\api\models\route.ts](C:/longyuchat/app/api/models/route.ts)
- [C:\longyuchat\app\api\models\[id]\route.ts](C:/longyuchat/app/api/models/[id]/route.ts)

### 前端页面

- [C:\longyuchat\components\models-page.tsx](C:/longyuchat/components/models-page.tsx)

### 测试

- [C:\longyuchat\tests\provider-connection-service.test.ts](C:/longyuchat/tests/provider-connection-service.test.ts)
- [C:\longyuchat\tests\model-config-service.test.ts](C:/longyuchat/tests/model-config-service.test.ts)
- [C:\longyuchat\tests\longyuchat-client.test.ts](C:/longyuchat/tests/longyuchat-client.test.ts)
- [C:\longyuchat\tests\api-presenters.test.ts](C:/longyuchat/tests/api-presenters.test.ts)

## 9. 建议下一位 AI 的处理顺序

建议按这个顺序接：

1. **先收模型页交互**
   - 把模型页压回“一步创建模型”的清晰主流程
   - 连接能力保留，但不压过主流程

2. **逐个验证 provider template**
   - 先做用户高频平台
   - 不要一口气重做全部平台
   - 重点看真实 `/models` 能否返回

3. **再决定 hybrid 模式是否长期保留**
   - 当前建议保留
   - 但需要进一步产品化表达

4. **最后再补更完整的引导和文案**

## 10. 测试覆盖与风险说明

这轮已经补了一部分自动化测试，但仍要诚实说明：

- 这次新增的测试，主要覆盖的是：
  - provider connection 服务
  - model config 与 connection 关联
  - client 请求层
  - presenter 输出

- 但按仓库 `AGENTS.md` 的最小测试要求，仍应继续确认或补齐以下核心链路：
  - mocked provider 的模型连接测试
  - 单聊消息保存
  - 群聊顺序回复
  - 后续模型可见前序模型本轮回复
  - 群聊中途失败时的部分成功行为
  - 历史消息重新加载

也就是说：

- 这轮“模型接入/连接管理”改造，并没有取代对 adapter / orchestrator / 持久化链路的最低测试要求
- 接手的人如果继续推进这部分，应该把这一点一直带着

## 11. 一句话总结

这一轮已经把“Provider 连接”后端骨架、模板目录、连接测试、按连接发现模型、模型与连接关联能力都搭起来了；真正还没收口的，是模型页的最终交互和各平台模板策略的产品化表达。
