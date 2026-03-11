# Server Ops

This document covers the four most practical post-launch tasks for a single-server AI Chat Lab deployment:

1. automatic SQLite backups
2. log rotation
3. one-click production updates
4. an Nginx config with gzip and safer static-asset caching

All examples below assume:

- app directory: `/srv/ai-chat-lab/app`
- data directory: `/srv/ai-chat-lab/data`
- log directory: `/srv/ai-chat-lab/var/log`
- backup directory: `/srv/ai-chat-lab/backups/sqlite`
- systemd service: `ai-chat-lab`

## 1. Install Automatic SQLite Backups

The repository already includes `npm run sqlite:backup`.

To install a daily cron job for the `ai-chat-lab` user:

```bash
cd /srv/ai-chat-lab/app
sudo bash scripts/install-sqlite-backup-cron.sh
```

Defaults:

- time: `03:30` every day
- user: `ai-chat-lab`
- log file: `/srv/ai-chat-lab/var/log/sqlite-backup.log`

Optional overrides:

```bash
cd /srv/ai-chat-lab/app
sudo APP_USER=ai-chat-lab BACKUP_HOUR=4 BACKUP_MINUTE=15 APP_LOG_DIR=/srv/ai-chat-lab/var/log bash scripts/install-sqlite-backup-cron.sh
```

Verify:

```bash
sudo crontab -u ai-chat-lab -l
```

## 2. Install Log Rotation

To rotate all application log files under `/srv/ai-chat-lab/var/log`:

```bash
cd /srv/ai-chat-lab/app
sudo bash scripts/install-logrotate.sh
```

Defaults:

- daily rotation
- keep `14` compressed copies
- use `copytruncate` so running services do not need a restart

Optional overrides:

```bash
cd /srv/ai-chat-lab/app
sudo APP_LOG_DIR=/srv/ai-chat-lab/var/log ROTATE_COUNT=21 bash scripts/install-logrotate.sh
```

Verify:

```bash
sudo cat /etc/logrotate.d/ai-chat-lab
sudo logrotate -d /etc/logrotate.d/ai-chat-lab
```

## 3. Use the One-Click Update Script

The production update script pulls the latest git changes, installs dependencies, applies Prisma migrations, rebuilds the app, restarts `systemd`, and runs a health check.

Run:

```bash
cd /srv/ai-chat-lab/app
sudo bash scripts/update-prod.sh
```

Behavior:

- reads `/srv/ai-chat-lab/app/.env` if present
- creates a SQLite backup before update by default
- keeps the current checked-out git branch unless `BRANCH_NAME` is set

Useful overrides:

```bash
cd /srv/ai-chat-lab/app
sudo BRANCH_NAME=main bash scripts/update-prod.sh
```

```bash
cd /srv/ai-chat-lab/app
sudo BACKUP_BEFORE_UPDATE=false bash scripts/update-prod.sh
```

If the health endpoint uses a Bearer token, the script will use it automatically from `.env`.
If no health token is configured but Basic Auth is enabled, it falls back to `BASIC_AUTH_USERNAME` and `BASIC_AUTH_PASSWORD`.

## 4. Apply the Optimized Nginx Template

The repository now includes:

- `docs/ai-chat-lab.nginx.conf.example`

It adds:

- gzip compression for text, JSON, CSS, JavaScript, XML, and SVG
- longer cache headers for `/_next/static`
- moderate caching for common asset extensions
- safer proxy buffer and timeout settings

To apply it on a Linux server:

```bash
sudo cp /srv/ai-chat-lab/app/docs/ai-chat-lab.nginx.conf.example /etc/nginx/sites-available/ai-chat-lab
sudo nano /etc/nginx/sites-available/ai-chat-lab
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
sudo systemctl status ai-chat-lab --no-pager
sudo systemctl status nginx --no-pager
sudo crontab -u ai-chat-lab -l
sudo logrotate -d /etc/logrotate.d/ai-chat-lab
curl -I https://your-domain.com
```
