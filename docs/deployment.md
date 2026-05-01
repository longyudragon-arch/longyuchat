# LongyuChat 部署手册

本文是本项目的权威部署 runbook。后续线程如果需要部署、排障或切换分支，优先看这份文档，不要猜目录、用户或服务名。

## 1. 统一约定

所有示例默认使用下面这套服务器布局：

- 应用用户：`longyuchat`
- 应用根目录：`/srv/longyuchat`
- 代码目录：`/srv/longyuchat/app`
- SQLite 数据目录：`/srv/longyuchat/data`
- 日志目录：`/srv/longyuchat/var/log`
- SQLite 备份目录：`/srv/longyuchat/backups/sqlite`
- systemd 服务名：`longyuchat`
- Node 监听地址：`127.0.0.1:3000`
- Nginx 对公网提供 HTTPS，再反代到 `127.0.0.1:3000`

如果你的服务器不是这个布局，部署命令里的 `APP_DIR`、`APP_USER`、`SERVICE_NAME` 和 systemd 文件必须同步改成真实值。

## 2. 当前推荐访问策略

公网部署推荐：

- 首页、AI 日报、归档、简历、项目页公开访问
- AI 聊天室、模型管理、后台管理接口需要站内登录
- 不使用浏览器 Basic Auth 弹窗

对应环境变量：

```env
APP_LOGIN_ENABLED=true
APP_LOGIN_USERNAME=your-admin-user
APP_LOGIN_PASSWORD=replace-with-a-long-random-password
APP_LOGIN_SESSION_SECRET=replace-with-openssl-rand-base64-32
APP_AUTH_SCOPE=chat
BASIC_AUTH_ENABLED=false
ALLOW_UNPROTECTED_ACCESS_IN_PRODUCTION=false
```

`APP_AUTH_SCOPE` 可选值：

- `chat`：只保护聊天室、模型管理、后台和会消耗模型 API 的接口
- `all`：保护整站

`APP_AUTH_SCOPE=chat` 时：

- 公开页面：`/`、`/daily`、`/daily/*`、`/about`、`/projects`
- 需要登录页面：`/rooms`、`/rooms/*`、`/models`、`/admin/*`
- 需要登录 API：`/api/rooms/*`、`/api/models/*`、`/api/provider-catalog`、`/api/provider-connections/*`、`/api/providers/*`、`/api/daily/admin/*`

## 3. 首次部署

### 3.1 安装系统依赖

Ubuntu 示例：

```bash
sudo apt update
sudo apt install -y git curl nginx
```

Node.js 推荐使用 Node 20 LTS。若服务器还没有 Node，请先安装 Node 20，再确认：

```bash
node -v
npm -v
```

### 3.2 创建应用用户和目录

```bash
sudo mkdir -p /srv/longyuchat
sudo useradd --system --create-home --home-dir /srv/longyuchat --shell /bin/bash longyuchat || true
sudo mkdir -p /srv/longyuchat/data /srv/longyuchat/var/log /srv/longyuchat/backups/sqlite
sudo chown -R longyuchat:longyuchat /srv/longyuchat
```

如果你之前遇到 `sudo: unknown user longyuchat`，说明这一步没有执行或服务器用了别的用户。

### 3.3 克隆代码

部署指定分支：

```bash
sudo -u longyuchat bash -lc '
cd /srv/longyuchat
git clone --branch codex/huashu-frontend-deep-optimization git@github.com:longyudragon-arch/longyuchat.git app
'
```

如果服务器不能用 SSH 拉 GitHub，也可以改 HTTPS：

```bash
sudo -u longyuchat bash -lc '
cd /srv/longyuchat
git clone --branch codex/huashu-frontend-deep-optimization https://github.com/longyudragon-arch/longyuchat.git app
'
```

### 3.4 写入生产环境变量

生成两个随机值：

```bash
openssl rand -base64 32
openssl rand -base64 32
```

编辑环境文件：

```bash
sudo -u longyuchat nano /srv/longyuchat/app/.env
```

最小生产模板：

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=file:/srv/longyuchat/data/app.db

ENABLE_DEV_MOCKS=false
NEXT_PUBLIC_ENABLE_DEV_MOCKS=false

APP_LOGIN_ENABLED=true
APP_LOGIN_USERNAME=your-admin-user
APP_LOGIN_PASSWORD=replace-with-a-long-random-password
APP_LOGIN_SESSION_SECRET=replace-with-openssl-rand-base64-32
APP_AUTH_SCOPE=chat
BASIC_AUTH_ENABLED=false
ALLOW_UNPROTECTED_ACCESS_IN_PRODUCTION=false

HEALTHCHECK_BEARER_TOKEN=replace-with-a-random-health-token
MODEL_SECRET_ENCRYPTION_KEY=replace-with-openssl-rand-base64-32

ENABLE_API_RATE_LIMITS=true
API_RATE_LIMIT_WINDOW_SECONDS=60
API_RATE_LIMIT_MAX_LOGIN_ATTEMPTS=5
API_RATE_LIMIT_MAX_MESSAGE_POSTS=12
API_RATE_LIMIT_MAX_MODEL_TESTS=10
API_RATE_LIMIT_MAX_MODEL_DISCOVERY=20

ENABLE_FILE_LOGGING=true
APP_LOG_DIR=/srv/longyuchat/var/log
SQLITE_BACKUP_DIR=/srv/longyuchat/backups/sqlite
SQLITE_BACKUP_RETENTION_DAYS=7
APP_LISTEN_HOST=127.0.0.1

AI_DAILY_ENABLED=true
AI_DAILY_MODEL_ID=
AI_DAILY_AUTOMATION_TOKEN=replace-with-a-random-daily-token
AI_DAILY_CANDIDATE_LIMIT=12
AI_DAILY_PUBLISH_ITEM_LIMIT=6
AI_DAILY_MINIMUM_ITEM_COUNT=3
AI_DAILY_HEURISTIC_SCORE_THRESHOLD=4.5
AI_DAILY_PUBLISH_WINDOW_HOURS=24
AI_DAILY_FEED_BASE_URL=https://your-domain.com
AI_DAILY_TIMEZONE=Asia/Shanghai
```

注意：

- `APP_LOGIN_SESSION_SECRET` 和 `MODEL_SECRET_ENCRYPTION_KEY` 都要用长随机值
- `MODEL_SECRET_ENCRYPTION_KEY` 设置后不要随意换，否则已有加密 API Key 无法解密
- `AI_DAILY_FEED_BASE_URL` 要改成真实域名，否则 RSS 链接会不正确

### 3.5 安装依赖、迁移和构建

```bash
sudo -u longyuchat bash -lc '
cd /srv/longyuchat/app
npm ci
npm run prisma:migrate:deploy
npm run build
'
```

### 3.6 创建 systemd 服务

```bash
sudo tee /etc/systemd/system/longyuchat.service >/dev/null <<'EOF'
[Unit]
Description=LongyuChat
After=network.target

[Service]
Type=simple
WorkingDirectory=/srv/longyuchat/app
EnvironmentFile=/srv/longyuchat/app/.env
ExecStart=/usr/bin/npm run start:prod
Restart=always
RestartSec=5
User=longyuchat
Group=longyuchat

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable longyuchat
sudo systemctl restart longyuchat
sudo systemctl --no-pager --full status longyuchat
```

如果服务启动失败，先看日志：

```bash
sudo journalctl -u longyuchat -n 120 --no-pager
```

### 3.7 配置 Nginx

创建站点配置：

```bash
sudo tee /etc/nginx/sites-available/longyuchat >/dev/null <<'EOF'
server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/longyuchat /etc/nginx/sites-enabled/longyuchat
sudo nginx -t
sudo systemctl reload nginx
```

HTTPS 证书可以用 Certbot 或云厂商证书。启用 HTTPS 后，保留反代到 `127.0.0.1:3000` 即可。

### 3.8 首次部署验证

```bash
sudo systemctl --no-pager --full status longyuchat
curl -fsS -H "Authorization: Bearer $(sudo grep '^HEALTHCHECK_BEARER_TOKEN=' /srv/longyuchat/app/.env | cut -d= -f2-)" http://127.0.0.1:3000/api/health
curl -I http://127.0.0.1:3000/
```

浏览器检查：

- `https://your-domain.com/` 应公开访问
- `https://your-domain.com/daily` 应公开访问
- `https://your-domain.com/rooms` 应跳到站内 `/login`
- 不应出现浏览器 Basic Auth 弹窗

## 4. 更新已有部署

### 4.1 更新当前分支

如果服务器已经部署好，并且当前 checkout 的就是目标分支：

```bash
sudo BRANCH_NAME="$(sudo -u longyuchat bash -lc 'cd /srv/longyuchat/app && git branch --show-current')" \
  APP_DIR="/srv/longyuchat/app" \
  APP_USER="longyuchat" \
  SERVICE_NAME="longyuchat" \
  BACKUP_BEFORE_UPDATE="true" \
  bash /srv/longyuchat/app/scripts/update-prod.sh
```

### 4.2 部署指定分支

部署 `codex/huashu-frontend-deep-optimization`：

```bash
sudo -u longyuchat bash -lc '
cd /srv/longyuchat/app
git fetch origin codex/huashu-frontend-deep-optimization
git checkout -B codex/huashu-frontend-deep-optimization origin/codex/huashu-frontend-deep-optimization
'

sudo BRANCH_NAME="codex/huashu-frontend-deep-optimization" \
  APP_DIR="/srv/longyuchat/app" \
  APP_USER="longyuchat" \
  SERVICE_NAME="longyuchat" \
  BACKUP_BEFORE_UPDATE="true" \
  bash /srv/longyuchat/app/scripts/update-prod.sh
```

`scripts/update-prod.sh` 会自动执行：

- SQLite 备份
- `git fetch`
- `git checkout`
- `git pull --ff-only`
- `npm ci`
- `npm run prisma:migrate:deploy`
- `npm run build`
- `systemctl restart longyuchat`
- `/api/health` 健康检查

## 5. 日常运维命令

查看服务：

```bash
sudo systemctl --no-pager --full status longyuchat
```

查看实时日志：

```bash
sudo journalctl -u longyuchat -f
```

手动备份 SQLite：

```bash
sudo -u longyuchat bash -lc 'cd /srv/longyuchat/app && npm run sqlite:backup'
```

安装 SQLite 自动备份：

```bash
cd /srv/longyuchat/app
sudo APP_USER=longyuchat APP_LOG_DIR=/srv/longyuchat/var/log bash scripts/install-sqlite-backup-cron.sh
```

安装日志轮转：

```bash
cd /srv/longyuchat/app
sudo APP_USER=longyuchat APP_GROUP=longyuchat APP_LOG_DIR=/srv/longyuchat/var/log bash scripts/install-logrotate.sh
```

## 6. AI 日报定时任务

如果已经配置好 `AI_DAILY_AUTOMATION_TOKEN`、至少一个可用模型和日报来源，添加 cron：

```bash
sudo crontab -u longyuchat -e
```

写入：

```cron
0 */2 * * * cd /srv/longyuchat/app && /usr/bin/npm run daily:scan >> /srv/longyuchat/var/log/daily-scan.log 2>&1
0 8 * * * cd /srv/longyuchat/app && /usr/bin/npm run daily:publish >> /srv/longyuchat/var/log/daily-publish.log 2>&1
```

## 7. 常见故障

### 7.1 unknown user longyuchat

原因：服务器没有创建应用用户。

修复：

```bash
sudo useradd --system --create-home --home-dir /srv/longyuchat --shell /bin/bash longyuchat || true
sudo chown -R longyuchat:longyuchat /srv/longyuchat
```

### 7.2 update-prod.sh 不存在

原因：项目没有克隆到 `/srv/longyuchat/app`，或服务器实际目录不同。

排查：

```bash
sudo find /srv /home -maxdepth 5 -type d -name .git 2>/dev/null | sed 's#/.git##'
```

如果这是首次部署，回到 `3.3 克隆代码`。

### 7.3 生产启动自检失败

看日志：

```bash
sudo journalctl -u longyuchat -n 120 --no-pager
```

常见原因：

- `DATABASE_URL` 未配置
- `ENABLE_DEV_MOCKS` 或 `NEXT_PUBLIC_ENABLE_DEV_MOCKS` 不是 `false`
- 没有配置 `APP_LOGIN_*` 且没有显式允许无保护访问
- `MODEL_SECRET_ENCRYPTION_KEY` 缺失
- SQLite 里仍有明文 API Key，需要先重新保存模型密钥让系统加密

### 7.4 仍然出现浏览器账号密码弹窗

检查 `.env`：

```bash
sudo grep -E '^(APP_LOGIN|APP_AUTH_SCOPE|BASIC_AUTH)' /srv/longyuchat/app/.env
```

应为：

```env
APP_LOGIN_ENABLED=true
APP_AUTH_SCOPE=chat
BASIC_AUTH_ENABLED=false
```

改完后：

```bash
sudo systemctl restart longyuchat
```

### 7.5 健康检查 401

如果 `/api/health` 受登录保护，使用 Bearer token：

```bash
curl -fsS -H "Authorization: Bearer your-health-token" http://127.0.0.1:3000/api/health
```

确保 `.env` 里有：

```env
HEALTHCHECK_BEARER_TOKEN=your-health-token
```

## 8. 上线检查清单

- `/srv/longyuchat/app` 是真实代码目录
- `longyuchat` 用户存在
- `/srv/longyuchat/app/.env` 已配置且没有提交到 Git
- `ENABLE_DEV_MOCKS=false`
- `NEXT_PUBLIC_ENABLE_DEV_MOCKS=false`
- `APP_LOGIN_ENABLED=true`
- `APP_AUTH_SCOPE=chat` 或 `APP_AUTH_SCOPE=all`
- `BASIC_AUTH_ENABLED=false`，除非明确要浏览器 Basic Auth
- `MODEL_SECRET_ENCRYPTION_KEY` 已配置且不会随意轮换
- `ENABLE_API_RATE_LIMITS=true`
- `ENABLE_FILE_LOGGING=true`
- `APP_LOG_DIR=/srv/longyuchat/var/log`
- `SQLITE_BACKUP_DIR=/srv/longyuchat/backups/sqlite`
- `npm run prisma:migrate:deploy` 已执行
- `npm run build` 通过
- `systemctl status longyuchat` 正常
- `/api/health` 返回 200
- Nginx `nginx -t` 通过
