# 部署说明

## 1. 当前推荐部署形态

本项目当前最适合下面两种部署方式：

- 个人低并发使用：`Node.js 20 LTS + Next.js + SQLite + Nginx + PM2/systemd`
- 计划长期稳定运行：`Node.js 20 LTS + Next.js + PostgreSQL + Nginx + PM2/systemd`

如果你只是自己使用、访问量很低，第一阶段可以继续使用 SQLite。

## 2. 上线前必须完成的设置

### 2.1 环境变量

复制 `.env.example` 到服务器环境变量或 `.env.production`，至少配置：

```bash
DATABASE_URL="file:/srv/ai-chat-lab/data/app.db"
ENABLE_DEV_MOCKS="false"
NEXT_PUBLIC_ENABLE_DEV_MOCKS="false"
BASIC_AUTH_ENABLED="true"
BASIC_AUTH_USERNAME="your-admin-user"
BASIC_AUTH_PASSWORD="replace-with-a-long-random-password"
HEALTHCHECK_BEARER_TOKEN="replace-with-a-random-health-token"
MODEL_SECRET_ENCRYPTION_KEY="replace-with-openssl-rand-base64-32"
ENABLE_API_RATE_LIMITS="true"
API_RATE_LIMIT_WINDOW_SECONDS="60"
API_RATE_LIMIT_MAX_MESSAGE_POSTS="12"
API_RATE_LIMIT_MAX_MODEL_TESTS="10"
API_RATE_LIMIT_MAX_MODEL_DISCOVERY="20"
ENABLE_FILE_LOGGING="true"
APP_LOG_DIR="/srv/ai-chat-lab/var/log"
SQLITE_BACKUP_DIR="/srv/ai-chat-lab/backups/sqlite"
SQLITE_BACKUP_RETENTION_DAYS="7"
ALLOW_UNPROTECTED_ACCESS_IN_PRODUCTION="false"
```

说明：

- 生产环境建议把 SQLite 文件放到项目目录之外的持久化目录
- `ENABLE_DEV_MOCKS` 和 `NEXT_PUBLIC_ENABLE_DEV_MOCKS` 在服务器上都应设为 `false`
- `BASIC_AUTH_ENABLED` 建议在公网服务器上设为 `true`
- `BASIC_AUTH_PASSWORD` 和 `HEALTHCHECK_BEARER_TOKEN` 请使用高强度随机值
- `MODEL_SECRET_ENCRYPTION_KEY` 建议使用 `openssl rand -base64 32` 生成
- `ENABLE_API_RATE_LIMITS` 建议在公网服务器上保持为 `true`
- 如需更保守地控制 token 消耗，可以下调 3 个 `API_RATE_LIMIT_MAX_*` 上限
- `ENABLE_FILE_LOGGING` 建议在公网服务器上保持为 `true`
- `APP_LOG_DIR` 建议放到项目目录之外或独立的持久化目录
- 使用 SQLite 时，建议显式配置 `SQLITE_BACKUP_DIR`
- `ALLOW_UNPROTECTED_ACCESS_IN_PRODUCTION` 仅在你已经通过其他网关做了访问保护时才建议设为 `true`

### 2.2 数据库

当前项目默认使用 SQLite。

上线时请至少做到：

- 使用固定绝对路径保存数据库文件
- 给数据库目录单独做读写权限
- 定期备份数据库文件

如果后面要支持更高并发或多人访问，建议迁移到 PostgreSQL。

### 2.3 模型 API Key 加密

项目现在支持把模型 `API Key` 加密后再存入数据库。

规则：

- 当 `MODEL_SECRET_ENCRYPTION_KEY` 已配置时，新创建和新更新的模型密钥会自动加密存储
- 旧的明文密钥仍然能兼容读取，避免现有数据立刻失效
- 生产环境如果没有配置 `MODEL_SECRET_ENCRYPTION_KEY`，将不能新增或更新模型密钥

建议：

- 在正式服务器上始终配置 `MODEL_SECRET_ENCRYPTION_KEY`
- 不要随意轮换该值，除非你已经准备好重新加密现有数据

### 2.4 网络入口

建议用 Nginx 做反向代理，并强制 HTTPS。

至少要有：

- TLS 证书
- 反向代理到 `127.0.0.1:3000`
- 请求体大小限制
- 基础访问控制

### 2.5 最小访问保护

项目已经内置 Basic Auth 中间件。

当以下变量配置完成后：

- `BASIC_AUTH_ENABLED=true`
- `BASIC_AUTH_USERNAME`
- `BASIC_AUTH_PASSWORD`

页面和 API 默认都会要求 Basic Auth。

说明：

- `/_next/*`、`favicon.ico` 这类静态资源不会被拦
- `/api/health` 默认也受保护
- 如果额外配置了 `HEALTHCHECK_BEARER_TOKEN`，则 `/api/health` 也支持 `Authorization: Bearer <token>`

### 2.6 生产启动自检

项目现在会在 `NODE_ENV=production` 启动时自动检查以下配置：

- `DATABASE_URL`
- `ENABLE_DEV_MOCKS=false`
- `NEXT_PUBLIC_ENABLE_DEV_MOCKS=false`
- `MODEL_SECRET_ENCRYPTION_KEY`
- `ENABLE_API_RATE_LIMITS=true`
- `ENABLE_FILE_LOGGING=true`
- `APP_LOG_DIR`
- `SQLITE_BACKUP_DIR`（当 `DATABASE_URL` 使用 SQLite 时）
- Basic Auth 已启用，或你显式设置了 `ALLOW_UNPROTECTED_ACCESS_IN_PRODUCTION=true`

如果这些关键项缺失，应用会在启动阶段直接失败，而不是等到上线后再暴露问题。

## 3. 生产构建与启动

### 3.1 安装依赖

```bash
npm ci
```

项目已经在 `postinstall` 中自动执行 Prisma Client 生成。

### 3.2 执行数据库迁移

```bash
npm run prisma:migrate:deploy
```

### 3.3 构建

```bash
npm run build
```

### 3.4 启动

```bash
npm run start:prod
```

默认监听 `0.0.0.0`，可配合 `PORT` 环境变量使用。

### 3.5 SQLite 手动备份

如果当前部署仍然使用 SQLite，可以随时执行：

```bash
npm run sqlite:backup
```

该命令会：

- 把当前 SQLite 数据库复制到 `SQLITE_BACKUP_DIR`
- 同时复制存在的 `-wal` / `-shm` 文件
- 按 `SQLITE_BACKUP_RETENTION_DAYS` 清理过旧备份

## 4. 建议的 systemd 配置

下面是一个基础示例：

```ini
[Unit]
Description=AI Chat Lab
After=network.target

[Service]
Type=simple
WorkingDirectory=/srv/ai-chat-lab
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=DATABASE_URL=file:/srv/ai-chat-lab/data/app.db
Environment=ENABLE_DEV_MOCKS=false
Environment=NEXT_PUBLIC_ENABLE_DEV_MOCKS=false
Environment=BASIC_AUTH_ENABLED=true
Environment=BASIC_AUTH_USERNAME=your-admin-user
Environment=BASIC_AUTH_PASSWORD=replace-with-a-long-random-password
Environment=HEALTHCHECK_BEARER_TOKEN=replace-with-a-random-health-token
Environment=MODEL_SECRET_ENCRYPTION_KEY=replace-with-openssl-rand-base64-32
Environment=ENABLE_API_RATE_LIMITS=true
Environment=API_RATE_LIMIT_WINDOW_SECONDS=60
Environment=API_RATE_LIMIT_MAX_MESSAGE_POSTS=12
Environment=API_RATE_LIMIT_MAX_MODEL_TESTS=10
Environment=API_RATE_LIMIT_MAX_MODEL_DISCOVERY=20
Environment=ENABLE_FILE_LOGGING=true
Environment=APP_LOG_DIR=/srv/ai-chat-lab/var/log
Environment=SQLITE_BACKUP_DIR=/srv/ai-chat-lab/backups/sqlite
Environment=SQLITE_BACKUP_RETENTION_DAYS=7
ExecStart=/usr/bin/npm run start:prod
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

## 5. Nginx 反向代理示例

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain/privkey.pem;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 6. 健康检查

项目已提供：

- `GET /api/health`

成功时返回：

- `status`
- `timestamp`
- `environment`
- `database`
- `devMocksEnabled`
- `apiRateLimitsEnabled`
- `fileLoggingEnabled`
- `logDirectory`
- `sqliteBackupConfigured`
- `sqliteBackupDirectory`
- `modelSecretEncryptionConfigured`
- `productionReadiness`

每个 API 响应头还会带上：

- `X-Request-Id`

如果数据库不可用，会返回 `503`。

示例：

```bash
curl -u your-admin-user:your-password https://your-domain.com/api/health
```

或者：

```bash
curl -H "Authorization: Bearer your-health-token" https://your-domain.com/api/health
```

说明：

- 线上报错时，可以先从响应头里的 `X-Request-Id` 找到对应服务端日志
- 服务端错误日志会自动脱敏常见的 `apiKey` 和 `Authorization: Bearer ...` 内容
- 当 `ENABLE_FILE_LOGGING=true` 时，错误和启动日志会按天写入 `APP_LOG_DIR`

## 6.1 最小请求限流

项目现在已经内置了面向单服务器部署的固定窗口限流，用于保护 3 类最容易消耗额度或被误触发的 POST 接口：

- `POST /api/rooms/:id/messages`
- `POST /api/models/:id/test`
- `POST /api/providers/discover-models`

当前策略：

- 生产环境默认开启，开发环境默认关闭
- 优先按 `Basic Auth` 用户名限流；如果没有认证用户名，则回退到请求 IP
- 触发上限时会返回 `429 Too Many Requests`
- 返回体会带上 `retryAfterSeconds`、`limit` 和 `windowSeconds`

说明：

- 这是最小可用的单进程限流，适合你当前单机部署的场景
- 如果后面改成多进程或多实例部署，建议再切换到 Redis 一类的共享限流存储

## 7. 当前仍建议优先优化的点

以下能力还没有完全产品化，部署到公网前建议继续补：

- 访问控制或登录鉴权
- 多实例部署时的 Redis 限流或更细的配额策略
- 外部监控告警和日志采集
- SQLite 备份定时调度（例如 cron / systemd timer）

## 7.1 建议的 SQLite 备份定时任务

可以在服务器上每天定时执行：

```bash
cd /srv/ai-chat-lab && /usr/bin/npm run sqlite:backup
```

例如 `cron`：

```cron
15 3 * * * cd /srv/ai-chat-lab && /usr/bin/npm run sqlite:backup >> /srv/ai-chat-lab/var/log/sqlite-backup.log 2>&1
```

## 8. 上线检查清单

- `.env.production` 已配置且没有真实密钥提交到仓库
- `ENABLE_DEV_MOCKS=false`
- `NEXT_PUBLIC_ENABLE_DEV_MOCKS=false`
- `BASIC_AUTH_ENABLED=true`
- `BASIC_AUTH_USERNAME` / `BASIC_AUTH_PASSWORD` 已配置
- `MODEL_SECRET_ENCRYPTION_KEY` 已配置
- `ENABLE_API_RATE_LIMITS=true`
- `ENABLE_FILE_LOGGING=true`
- `APP_LOG_DIR` 已配置
- `SQLITE_BACKUP_DIR` 已配置（SQLite 部署）
- `npm run prisma:migrate:deploy` 已执行
- `npm run build` 通过
- `npm run sqlite:backup` 已验证可执行（SQLite 部署）
- `GET /api/health` 返回 `200`
- Nginx HTTPS 已生效
- 服务器目录和数据库文件权限已收紧
