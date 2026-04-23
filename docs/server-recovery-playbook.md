# 服务器重装最短恢复手册

本手册用于 **Ubuntu 22.04 全新重装后**，把 `LongyuChat` 以最短路径恢复到可用状态。

目标不是解释所有原理，而是提供一套可以直接照着执行的恢复流程。

## 1. 恢复前必须准备的 3 样东西

至少准备下面 3 项：

1. 一个最新的恢复包，例如：
   - `longyuchat-recovery-2026-04-10-213415.tar.gz.enc`
2. 一个最新的 SQLite 数据库备份文件
3. 恢复包的解密密码

说明：

- 恢复包里应包含：
  - `.env.production`
  - deploy key
  - `systemd` 服务文件
  - Nginx 站点配置
- SQLite 备份用于恢复模型、连接、房间、聊天记录

## 2. 这套恢复流程最终会恢复什么

恢复完成后，应具备：

- `Node.js 20`
- `Nginx`
- 项目代码
- `.env.production`
- `/srv/longyuchat/data/app.db`
- `/etc/systemd/system/longyuchat.service`
- `/etc/nginx/sites-available/longyuchat`
- GitHub deploy key
- HTTPS 证书

## 3. 一次性安装系统依赖

```bash
sudo apt update
sudo apt install -y git curl nginx build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs certbot python3-certbot-nginx
```

验证：

```bash
node -v
npm -v
```

## 4. 创建运行用户和目录

```bash
sudo mkdir -p /srv/longyuchat
sudo useradd -r -s /usr/sbin/nologin -d /srv/longyuchat longyuchat || true
sudo chown -R longyuchat:longyuchat /srv/longyuchat

sudo -u longyuchat mkdir -p /srv/longyuchat/.ssh
sudo -u longyuchat mkdir -p /srv/longyuchat/data
sudo -u longyuchat mkdir -p /srv/longyuchat/var/log
sudo -u longyuchat mkdir -p /srv/longyuchat/backups/sqlite
sudo chmod 700 /srv/longyuchat/.ssh
```

## 5. 解密恢复包到临时目录

假设恢复包已经放在：

- `/root/restore/longyuchat-recovery.tar.gz.enc`

执行：

```bash
sudo mkdir -p /tmp/longyuchat-recovery
sudo rm -rf /tmp/longyuchat-recovery/*

openssl enc -d -aes-256-cbc -pbkdf2 \
  -in /root/restore/longyuchat-recovery.tar.gz.enc \
| sudo tar -xzf - -C /tmp/longyuchat-recovery
```

说明：

- 这里会提示输入恢复包密码
- 解压后一般会出现：
  - `/tmp/longyuchat-recovery/srv/longyuchat/...`
  - `/tmp/longyuchat-recovery/etc/...`

## 6. 先恢复 deploy key、systemd、Nginx 配置

```bash
sudo cp /tmp/longyuchat-recovery/srv/longyuchat/.ssh/id_ed25519 /srv/longyuchat/.ssh/
sudo cp /tmp/longyuchat-recovery/srv/longyuchat/.ssh/id_ed25519.pub /srv/longyuchat/.ssh/
sudo chown longyuchat:longyuchat /srv/longyuchat/.ssh/id_ed25519 /srv/longyuchat/.ssh/id_ed25519.pub
sudo chmod 600 /srv/longyuchat/.ssh/id_ed25519
sudo chmod 644 /srv/longyuchat/.ssh/id_ed25519.pub

sudo cp /tmp/longyuchat-recovery/etc/systemd/system/longyuchat.service /etc/systemd/system/
sudo cp /tmp/longyuchat-recovery/etc/nginx/sites-available/longyuchat /etc/nginx/sites-available/
```

## 7. 重新拉取代码

```bash
sudo -u longyuchat git clone git@github.com:longyudragon-arch/longyuchat.git /srv/longyuchat/app

sudo -u longyuchat git -C /srv/longyuchat/app config core.sshCommand "ssh -i /srv/longyuchat/.ssh/id_ed25519 -o IdentitiesOnly=yes"

sudo -u longyuchat bash -c '
cd /srv/longyuchat/app &&
git fetch origin &&
git checkout codex/mvp-hardening-pass &&
git reset --hard origin/codex/mvp-hardening-pass
'
```

如果以后生产分支调整了，把上面的分支名替换成当前实际部署分支。

## 8. 恢复 `.env.production`

```bash
sudo cp /tmp/longyuchat-recovery/srv/longyuchat/app/.env.production /srv/longyuchat/app/.env.production
sudo chown longyuchat:longyuchat /srv/longyuchat/app/.env.production
sudo chmod 600 /srv/longyuchat/app/.env.production
```

快速确认：

```bash
sudo -u longyuchat bash -c 'cd /srv/longyuchat/app && grep -E "DATABASE_URL|BASIC_AUTH_ENABLED|APP_LISTEN_HOST" .env.production'
```

## 9. 恢复 SQLite 数据库

假设你把最新数据库备份放在：

- `/root/restore/app.db`

执行：

```bash
sudo cp /root/restore/app.db /srv/longyuchat/data/app.db
sudo chown longyuchat:longyuchat /srv/longyuchat/data/app.db
sudo chmod 600 /srv/longyuchat/data/app.db
```

如果你备份的是项目自带脚本生成的 SQLite 备份，也可以先挑一个最新文件恢复为：

- `/srv/longyuchat/data/app.db`

## 10. 安装依赖、执行迁移、构建

注意：

- 这里要让 Prisma 明确加载 `.env.production`
- 不要用 `root` 直接跑 `npm ci` / `build`

```bash
sudo -u longyuchat bash -c '
set -a
source /srv/longyuchat/app/.env.production
set +a
cd /srv/longyuchat/app &&
npm ci &&
npm run prisma:migrate:deploy &&
npm run build
'
```

## 11. 启用 systemd 服务

```bash
sudo systemctl daemon-reload
sudo systemctl enable longyuchat
sudo systemctl restart longyuchat
sudo systemctl status longyuchat --no-pager
```

## 12. 启用 Nginx

```bash
sudo ln -sf /etc/nginx/sites-available/longyuchat /etc/nginx/sites-enabled/longyuchat
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

验证本机反代是否打到应用：

```bash
curl -I http://127.0.0.1
```

如果应用启用了 Basic Auth，正常会返回：

- `401 Unauthorized`

## 13. 重新申请 HTTPS 证书

如果 `/etc/letsencrypt` 没有单独备份，重装后最简单的做法就是重新签发：

```bash
sudo certbot --nginx -d longyu.chat -d www.longyu.chat
```

如果只使用主域名，则改成：

```bash
sudo certbot --nginx -d longyu.chat
```

验证自动续期：

```bash
sudo certbot renew --dry-run
```

## 14. 恢复后的最小验收

```bash
curl -I http://longyu.chat
curl -I https://longyu.chat
curl -u admin:your-password https://longyu.chat/api/models
curl -u admin:your-password https://longyu.chat/api/provider-connections
curl -u admin:your-password https://longyu.chat/api/rooms
```

预期：

- HTTP 跳 HTTPS
- HTTPS 返回 `401` 或正常页面
- 3 个 API 返回 JSON，而不是 `500`

## 15. 恢复完成后立刻要做的事

恢复成功后，建议立刻执行下面两件事：

1. 重新安装数据库自动备份

```bash
crontab -e
```

加入：

```cron
15 3 * * * cd /srv/longyuchat/app && /usr/bin/npm run sqlite:backup >> /srv/longyuchat/var/log/sqlite-backup.log 2>&1
```

2. 重新生成一份新的恢复包

```bash
/usr/local/bin/longyuchat-backup-recovery.sh
```

这样下次恢复时就不会还拿旧包。

## 16. 最小记忆版

如果你以后只想记最短版本，就记下面这 8 步：

1. 装 `Node 20 + Git + Nginx + Certbot`
2. 建 `/srv/longyuchat` 和 `longyuchat` 用户
3. 解密恢复包
4. 先恢复 `.ssh`、`systemd`、Nginx 配置
5. 拉代码
6. 恢复 `.env.production` 和 `app.db`
7. `npm ci && prisma migrate deploy && build`
8. 启动 `systemd`、恢复 Nginx、重签 HTTPS

这套流程的目标只有一个：

**以后服务器重装时，不再靠回忆和聊天记录从头摸一遍。**
