# 登录体系规划

## 当前阶段：单用户站内登录

当前版本已经支持基于环境变量的站内登录，用应用自己的登录页替代浏览器级 Basic Auth。

适用场景：

- 个人部署
- 单人长期使用
- 手机浏览器、微信内打开、PWA 安装

当前实现特点：

- 使用 `APP_LOGIN_USERNAME` 和 `APP_LOGIN_PASSWORD` 作为单用户账号
- 使用 `APP_LOGIN_SESSION_SECRET` 生成会话 Cookie
- `proxy.ts` 统一保护页面和 API
- `/login` 作为登录入口
- `/api/auth/login`、`/api/auth/logout`、`/api/auth/session` 负责登录态

推荐生产配置：

```env
APP_LOGIN_ENABLED="true"
APP_LOGIN_USERNAME="owner"
APP_LOGIN_PASSWORD="replace-with-a-long-random-password"
APP_LOGIN_SESSION_SECRET="replace-with-a-long-random-secret"
BASIC_AUTH_ENABLED="false"
```

## 下一阶段：正式账号体系

当项目从“单用户个人工具”升级到“多人协作系统”时，建议按下面顺序演进。

### 阶段 1：本地账号表

目标：

- 支持多个用户
- 每个用户拥有自己的模型配置和房间
- 从环境变量账号过渡到数据库用户

建议新增：

- `users`
- `user_sessions`
- `password_reset_tokens`

关键要求：

- 密码只存哈希值，不存明文
- 会话写数据库或 Redis，不再使用固定单用户 Cookie
- 房间、消息、模型配置都要增加 `user_id`

### 阶段 2：权限与邀请

目标：

- 后台管理
- 受控邀请
- 团队共享

建议新增：

- 角色：`owner` / `admin` / `member`
- 邀请码或邀请链接
- 登录审计日志

### 阶段 3：第三方登录

可选方向：

- 微信登录
- Google 登录
- GitHub 登录

适用场景：

- 需要降低注册成本
- 希望支持跨设备同步
- 计划引入多端统一身份

## 为什么先移除 Basic Auth

浏览器级 Basic Auth 有几个明显问题：

- 微信和部分移动端 WebView 体验差
- 无法做品牌化登录页
- 无法自然过渡到正式用户体系
- 退出登录、会话管理、风控提示都不灵活

所以当前版本保留 `BASIC_AUTH_*` 作为可选兜底，但默认更推荐使用站内登录。
