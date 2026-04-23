# 服务器访问与更新说明

## 四条常用命令分别做什么

### 1. 查看服务状态

```bash
sudo systemctl status longyuchat --no-pager
```

作用：

- 查看应用服务是否正在运行
- 看最近一次启动是否成功
- 快速确认是否被 systemd 自动拉起

### 2. 实时查看应用日志

```bash
sudo journalctl -u longyuchat -f
```

作用：

- 实时追踪应用输出
- 适合排查启动失败、模型请求报错、环境变量问题

### 3. 一键更新生产环境

```bash
sudo bash /srv/longyuchat/app/scripts/update-prod.sh
```

作用：

- 先备份 SQLite
- 从 GitHub 拉取最新代码
- 执行 `npm ci`
- 执行数据库迁移
- 重新构建 Next.js
- 重启 `longyuchat`
- 自动做健康检查

这是日常更新最推荐的命令。

### 4. 手动执行数据库备份

```bash
sudo -u longyuchat -H bash -lc 'cd /srv/longyuchat/app && npm run sqlite:backup'
```

作用：

- 立即生成一份 SQLite 备份
- 适合大改动前、升级前、手工兜底备份

## 以后如何一键更新运行

如果服务器已经部署完成，平时更新不需要手动一条条执行 `git pull`、`npm ci`、`npm run build`。

直接执行：

```bash
cd /srv/longyuchat/app
sudo bash scripts/update-prod.sh
```

或者如果你已经把全局命令装好了，也可以执行：

```bash
sudo /usr/local/bin/longyuchat-update
```

## 切换到站内登录

如果你要去掉 Basic Auth，改成应用自己的登录页，请在服务器 `.env` 里这样改：

```env
APP_LOGIN_ENABLED="true"
APP_LOGIN_USERNAME="owner"
APP_LOGIN_PASSWORD="replace-with-a-strong-password"
APP_LOGIN_SESSION_SECRET="replace-with-a-random-secret"
BASIC_AUTH_ENABLED="false"
```

建议：

- `APP_LOGIN_PASSWORD` 使用高强度随机密码
- `APP_LOGIN_SESSION_SECRET` 使用长随机字符串
- 保留 `HEALTHCHECK_BEARER_TOKEN`，这样更新脚本和探活更稳定

改完后执行：

```bash
sudo systemctl restart longyuchat
```

完成后：

- 浏览器访问站点会进入 `/login`
- 微信或手机浏览器打开时，也会看到应用自己的登录页
- 不会再出现浏览器级的 `Authentication required` 弹窗

## 手机浏览器 / 微信打开不稳定时

如果出现：

- `ERR_CONNECTION_CLOSED`
- 需要刷新很多次才能打开
- 手机浏览器和微信内 WebView 都不稳定

优先检查 Nginx 反代配置是否过于激进。当前项目不依赖 WebSocket，所以推荐使用更保守的代理方式：

- 暂时关闭 `http2`
- 去掉 `proxy_set_header Upgrade`
- 去掉固定的 `proxy_set_header Connection "upgrade"`
- 关闭 `proxy_buffering`

这类调整通常更适合微信内 WebView 和部分移动网络环境。
