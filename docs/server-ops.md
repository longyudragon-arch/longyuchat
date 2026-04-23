# Server Ops

This document covers the four most practical post-launch tasks for a single-server LongyuChat deployment:

1. automatic SQLite backups
2. log rotation
3. one-click production updates
4. an Nginx config with gzip and safer static-asset caching
5. AI 日报定时任务

All examples below assume:

- app directory: `/srv/longyuchat/app`
- data directory: `/srv/longyuchat/data`
- log directory: `/srv/longyuchat/var/log`
- backup directory: `/srv/longyuchat/backups/sqlite`
- systemd service: `longyuchat`

## 1. Install Automatic SQLite Backups

The repository already includes `npm run sqlite:backup`.

To install a daily cron job for the `longyuchat` user:

```bash
cd /srv/longyuchat/app
sudo bash scripts/install-sqlite-backup-cron.sh
```

Defaults:

- time: `03:30` every day
- user: `longyuchat`
- log file: `/srv/longyuchat/var/log/sqlite-backup.log`

Optional overrides:

```bash
cd /srv/longyuchat/app
sudo APP_USER=longyuchat BACKUP_HOUR=4 BACKUP_MINUTE=15 APP_LOG_DIR=/srv/longyuchat/var/log bash scripts/install-sqlite-backup-cron.sh
```

Verify:

```bash
sudo crontab -u longyuchat -l
```

## 2. Install Log Rotation

To rotate all application log files under `/srv/longyuchat/var/log`:

```bash
cd /srv/longyuchat/app
sudo bash scripts/install-logrotate.sh
```

Defaults:

- daily rotation
- keep `14` compressed copies
- use `copytruncate` so running services do not need a restart

Optional overrides:

```bash
cd /srv/longyuchat/app
sudo APP_LOG_DIR=/srv/longyuchat/var/log ROTATE_COUNT=21 bash scripts/install-logrotate.sh
```

Verify:

```bash
sudo cat /etc/logrotate.d/longyuchat
sudo logrotate -d /etc/logrotate.d/longyuchat
```

## 3. Use the One-Click Update Script

The production update script pulls the latest git changes, installs dependencies, applies Prisma migrations, rebuilds the app, restarts `systemd`, and runs a health check.

Run:

```bash
cd /srv/longyuchat/app
sudo bash scripts/update-prod.sh
```

Behavior:

- reads `/srv/longyuchat/app/.env` if present
- creates a SQLite backup before update by default
- keeps the current checked-out git branch unless `BRANCH_NAME` is set

Useful overrides:

```bash
cd /srv/longyuchat/app
sudo BRANCH_NAME=main bash scripts/update-prod.sh
```

```bash
cd /srv/longyuchat/app
sudo BACKUP_BEFORE_UPDATE=false bash scripts/update-prod.sh
```

If the health endpoint uses a Bearer token, the script will use it automatically from `.env`.
If no health token is configured but Basic Auth is enabled, it falls back to `BASIC_AUTH_USERNAME` and `BASIC_AUTH_PASSWORD`.

## 4. Apply the Optimized Nginx Template

The repository now includes:

- `docs/longyuchat.nginx.conf.example`

It adds:

- gzip compression for text, JSON, CSS, JavaScript, XML, and SVG
- longer cache headers for `/_next/static`
- moderate caching for common asset extensions
- safer proxy buffer and timeout settings

To apply it on a Linux server:

```bash
sudo cp /srv/longyuchat/app/docs/longyuchat.nginx.conf.example /etc/nginx/sites-available/longyuchat
sudo nano /etc/nginx/sites-available/longyuchat
```

Replace:

- `your-domain.com`
- certificate file paths under `/etc/letsencrypt/live/...`

Then verify and reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

If Certbot already manages your file, merge only the gzip, cache, timeout, and static asset sections into the current active Nginx file instead of overwriting it blindly.

## 5. Recommended Order on a Real Server

1. install automatic SQLite backups
2. install log rotation
3. verify `npm run sqlite:backup` manually once
4. merge the optimized Nginx config and reload Nginx
5. use `scripts/update-prod.sh` for all later deployments

## 6. Quick Verification Commands

```bash
sudo systemctl status longyuchat --no-pager
sudo systemctl status nginx --no-pager
sudo crontab -u longyuchat -l
sudo logrotate -d /etc/logrotate.d/longyuchat
curl -I https://your-domain.com
```

## 7. AI 日报的建议调度

如果你已经配置好：

- `AI_DAILY_AUTOMATION_TOKEN`
- 至少一个可用模型
- 默认来源或自定义来源

推荐增加这两条 cron：

```cron
0 */2 * * * cd /srv/longyuchat/app && /usr/bin/npm run daily:scan >> /srv/longyuchat/var/log/daily-scan.log 2>&1
0 8 * * * cd /srv/longyuchat/app && /usr/bin/npm run daily:publish >> /srv/longyuchat/var/log/daily-publish.log 2>&1
```

这样可以做到：

- 每 2 小时增量扫描来源
- 每天早上自动生成并发布 AI 日报
