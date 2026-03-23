# Frontend Collaboration Boundaries

## 1. 目的

本文档用于明确多代理协作时的职责边界，避免前端改版过程中出现互相覆盖、接口漂移或无意破坏后端逻辑的情况。

当前协作对象：

- `Codex`
- `Gemini CLI`

## 2. 总体分工

### Codex 负责

- 后端接口
- 服务层
- 适配器层
- 多模型顺序编排器
- 数据结构与共享类型
- 认证与部署
- 前端改版中需要补充的小型接口或工具函数
- 最终集成、验证和上线协助

### Gemini CLI 负责

- 页面布局
- 视觉风格
- 交互细节
- 页面层组件重构
- 移动端适配
- 中文文案体验优化
- 工作台成品感打磨

## 3. Gemini CLI 默认不要修改的内容

除非明确需要协作并说明原因，否则不要主动修改：

- `app/api/**`
- `server/**`
- `prisma/**`
- `generated/**`
- 认证逻辑
- 数据库 schema
- Provider 枚举值
- 顺序回复业务语义
- 加密、限流、部署脚本

## 4. 可以修改的主要区域

Gemini CLI 可以优先修改：

- `components/**`
- `app/**` 中的页面入口文件
- `app/globals.css`
- `lib/client/**`

如果需要新增纯前端工具函数，也尽量放在：

- `lib/client/**`

## 5. 接口契约底线

Gemini CLI 设计和重构前端时，必须保留现有接口语义：

- `GET /api/models`
- `POST /api/models`
- `PUT /api/models/:id`
- `DELETE /api/models/:id`
- `POST /api/models/:id/test`
- `POST /api/providers/discover-models`
- `GET /api/rooms`
- `POST /api/rooms`
- `PUT /api/rooms/:id`
- `DELETE /api/rooms/:id`
- `PUT /api/rooms/:id/configuration`
- `GET /api/rooms/:id/messages`
- `POST /api/rooms/:id/messages`
- `PUT /api/rooms/:id/order`
- `GET /api/auth/session`
- `POST /api/auth/login`
- `POST /api/auth/logout`

不要擅自改变：

- 字段名
- 枚举值
- 业务状态含义

## 6. 聊天页的绝对保护项

聊天页是本产品的核心页面，前端优化时必须保留这些行为：

- 用户消息先出现
- AI 回复按顺序逐条出现
- 不能等所有模型都完成后再统一渲染
- 必须体现当前轮到谁
- 中途失败时保留已成功回复
- 可以展示 `partial`，但不能把它误处理成整体失败

## 7. 推荐协作流程

### 方案 A：Gemini 先做前端，Codex 最后集成

适合：

- 页面视觉大改
- 多个组件一起重构

流程：

1. Gemini 在 `codex/gemini-frontend-workspace` 修改前端
2. Gemini 跑：
   - `npm test`
   - `npm run lint`
   - `npm run build`
3. Codex 再接手做：
   - 差异审查
   - 必要修补
   - 与当前后端状态对齐
   - 部署说明

### 方案 B：Gemini 做页面，Codex 补接口小改

适合：

- 页面想要新增一点展示字段
- 需要更细的状态提示

流程：

1. Gemini 先说明需要什么字段
2. Codex 评估是否复用现有接口
3. 如有必要，由 Codex 补最小接口变更
4. Gemini 再接页面

## 8. 冲突避免建议

- Gemini 一次尽量只专注一个页面或一个主题
- 不要一次性重做所有页面
- 如果要改聊天页，尽量不要同时动模型页和建房页
- 如果要改全局壳层，尽量不要顺手改后端逻辑

## 9. 提交建议

Gemini CLI 的提交尽量按主题拆分，例如：

- `refactor: polish mobile chat shell`
- `refactor: simplify model center layout`
- `feat: improve room timeline emphasis`

避免：

- 一个提交同时改聊天页、模型页、后端接口和数据库

## 10. 必做验证

每轮改动后至少执行：

```bash
npm test
npm run lint
npm run build
```

如果涉及明显交互变化，建议再做：

- 桌面页面冒烟检查
- 手机宽度页面冒烟检查

## 11. Codex 接手时关注什么

当 Gemini 完成一轮前端改动后，Codex 接手主要检查：

- 有没有误改接口契约
- 有没有破坏聊天页顺序回复语义
- 有没有把业务逻辑塞进组件
- 有没有新出现明显英文文案或乱码
- 是否通过 `test/lint/build`

## 12. 一句话协作原则

Gemini CLI 负责把页面做漂亮、做顺手；Codex 负责保证它继续可运行、可集成、可上线。
