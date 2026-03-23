# Gemini Frontend Handoff

## 1. 目的

本文档用于让新的前端协作代理快速理解当前项目状态，并在**不破坏现有后端契约**的前提下继续完成前端设计与交互优化。

当前可交接基线：

- 分支基线：`codex/stitch-preview`
- 交接分支：`codex/frontend-handoff`
- 交接时间：`2026-03-23`

## 2. 项目是什么

这是一个 `AI 多模型聊天室` Web 产品，当前核心能力是：

- 配置多个模型
- 测试模型连接
- 创建单聊或多模型群聊
- 群聊按固定顺序回复
- 保存聊天记录并续聊

当前已上线的前端目标不是“管理后台”，而是一个偏产品化的中文工作台：

- 首页是工作台入口
- 模型页是模型配置中心
- 房间列表页是会话入口
- 新建房间页负责“选择模型 + 排顺序”
- 聊天页负责“消息流 + 当前轮次 + 顺序控制”

## 3. 技术栈

- `Next.js 16`
- `React 19`
- `TypeScript`
- `Tailwind CSS`
- `App Router`

后端仍在同仓库中，但本轮协作主要负责前端页面与交互。

## 4. 重要原则

### 4.1 不要改坏后端契约

尽量不要主动修改这些目录：

- `app/api/**`
- `server/**`
- `prisma/**`
- `types/app.ts` 里的现有字段语义

如果确实需要新增展示字段，请尽量先复用已有接口，避免擅自重构接口结构。

### 4.2 保留现有业务语义

前端必须兼容这些已实现行为：

- 用户消息先保存，再开始模型顺序调用
- 群聊按排序顺序依次回复
- 后一个模型能看到前一个模型本轮回复
- 中途失败时，已成功回复保留，后续模型停止
- 接口可能返回 `partial`
- 聊天页必须正确展示：
  - 发送中
  - 进行中
  - 已完成
  - 部分完成

### 4.3 允许大改页面，但不要把逻辑搬进 UI

页面可以大改布局和视觉，但不要把第三方模型调用、顺序编排逻辑、数据库逻辑写回组件里。

## 5. 当前页面与入口

### 页面路由

- `/` 首页
- `/login` 登录页
- `/models` 模型管理
- `/rooms` 房间列表
- `/rooms/new` 新建房间
- `/rooms/[id]` 聊天页
- `/rooms/[id]/edit` 编辑房间

### 主要页面组件

- `components/home-dashboard.tsx`
- `components/login-page.tsx`
- `components/models-page.tsx`
- `components/rooms-page.tsx`
- `components/create-room-page.tsx`
- `components/room-chat-page.tsx`
- `components/edit-room-page.tsx`
- `components/app-navigation.tsx`

## 6. 当前前端已经完成到什么程度

### 6.1 已完成

- 整站已经基本转成中文产品工作台风格
- 首页从宣传说明改成了行动优先的工作台入口
- 聊天页支持：
  - 用户消息立即出现
  - AI 回复依次渲染
  - 当前轮次焦点卡
  - 轮次时间线
  - 粘性焦点提示
- 手机端首页和聊天页已经做过一轮“非缩小版网页”的适配
- 顶部导航、模型标签、主要状态文案已做中文化
- Stitch 导出的设计语言已被部分吸收，但不是逐像素还原

### 6.2 当前最需要继续优化的方向

- 聊天页的细节动效和消息层级还可以继续打磨
- 模型页、建房页、编辑房间页仍然有部分“工程后台”感，成品感还不够极致
- 移动端整体虽然已比之前好，但还可以更像原生应用
- 某些下拉选项仍然是“中文 / 英文”并存，后续可继续精简显示层

## 7. 当前设计语言

当前前端不是纯浅色后台，也不是纯深色产品，整体是：

- 浅暖色背景
- 深蓝主叙事面板
- 玻璃拟态浅色卡片
- 橙色作为主行动色
- 不同 provider 有独立颜色系统

关键词：

- 中文工作台
- 多模型协作
- 顺序链路
- 玻璃感
- 暖色品牌感

## 8. 聊天页的关键交互

聊天页是最核心页面，继续设计时优先保护这里。

### 当前聊天页已具备

- 顶部房间信息区
- 当前轮次焦点卡
- 轮次时间线
- 消息流
- 用户消息状态
- AI 消息区分
- 右侧顺序控制
- 手机端 `聊天 / 顺序` 切换

### 必须保留的体验

- 用户发出消息后不要等待全部模型结束才一起渲染
- 要体现“谁先说、谁正在说、谁还没轮到”
- 中途失败时，不能把已出现的成功回复抹掉

## 9. Provider 展示层

Provider 枚举仍然是这些固定值：

- `OPENAI_COMPATIBLE`
- `CLAUDE`
- `GEMINI`
- `GROK`
- `DOUBAO`
- `DEEPSEEK`
- `MODELSCOPE`
- `HUNYUAN`
- `QWEN`

不要改这些枚举值。

相关展示工具在：

- `lib/client/chat-lab-client.ts`

里面已有：

- `getProviderBadgeClassName`
- `getProviderIconClassName`
- `getProviderSoftClassName`
- `getProviderShortName`
- `getProviderOptionLabel`
- `getProviderChineseLabel`

## 10. 共享类型

主要看：

- `types/app.ts`

重点类型：

- `ModelView`
- `RoomView`
- `MessageView`
- `SendRoomMessageResult`
- `AuthSessionView`
- `DiscoveredModelView`

## 11. 可用接口

### 认证

- `GET /api/auth/session`
- `POST /api/auth/login`
- `POST /api/auth/logout`

### 模型

- `GET /api/models`
- `POST /api/models`
- `GET /api/models/:id`
- `PUT /api/models/:id`
- `DELETE /api/models/:id`
- `POST /api/models/:id/test`
- `POST /api/providers/discover-models`

### 房间

- `GET /api/rooms`
- `POST /api/rooms`
- `PUT /api/rooms/:id`
- `DELETE /api/rooms/:id`
- `PUT /api/rooms/:id/configuration`
- `GET /api/rooms/:id/messages`
- `POST /api/rooms/:id/messages`
- `PUT /api/rooms/:id/order`

## 12. 当前最值得看的文件

如果要快速理解当前前端状态，建议先读：

1. `components/room-chat-page.tsx`
2. `components/home-dashboard.tsx`
3. `components/app-navigation.tsx`
4. `components/models-page.tsx`
5. `components/create-room-page.tsx`
6. `components/edit-room-page.tsx`
7. `lib/client/chat-lab-client.ts`
8. `types/app.ts`

## 13. 本地开发方式

### 启动开发环境

```bash
npm run dev
```

### 质量检查

```bash
npm test
npm run lint
npm run build
```

## 14. 当前协作建议

如果 Gemini CLI 继续做前端，建议优先级如下：

1. 继续收聊天页视觉与动效
2. 继续优化手机端壳层与导航
3. 继续精简中英混排展示
4. 提升模型页 / 建房页 / 编辑页的成品感

## 15. 不建议做的事

- 不要把后端逻辑搬进页面组件
- 不要直接修改顺序回复业务语义
- 不要重构 API 返回结构，除非真的必要
- 不要引入额外大型状态管理库
- 不要为了视觉重做而破坏当前可运行链路

## 16. 一句话总结

这是一个已经跑通核心业务的 `AI 多模型顺序协作聊天` 产品原型；当前任务不是重写系统，而是在**保住现有后端与业务语义**的基础上，把前端继续打磨成更像正式产品的工作台。
