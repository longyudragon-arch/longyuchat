# 服务器安全加固交接记录

## 1. 文档目的

本文件用于记录这台公网 Linux 服务器已完成的基础安全检查与最小加固结果，方便后续维护、交接和复核。

本文件刻意不记录以下敏感信息：

- 公网 IP
- SSH 私钥位置与私钥内容
- 本地账号密码
- 宝塔随机安全入口
- 宝塔二次验证种子
- 各类登录令牌、API token、会话 token

如需查看敏感信息，应在服务器本机或受控密码库中查询，不应写入仓库。

## 2. 审计对象与边界

审计时的服务器背景如下：

- 云平台：腾讯云轻量应用服务器
- 系统：Ubuntu 22.04
- 场景：公网 Linux 主机，已存在网站与 Node.js 应用，不按“纯空白机”处理
- 面板：保留宝塔面板
- Web 服务：Nginx 对外，Node.js 应用仅监听本地回环地址

本次工作聚焦：

- 云防火墙与主机防火墙
- SSH 配置
- 账号与提权面
- 暴露端口与非必要服务
- Fail2ban
- 系统补丁与自动更新
- 基础日志与恢复能力
- 少量低风险内核与文件权限加固

## 3. 已完成的安全操作

### 3.1 SSH 加固

已完成：

- 禁用 SSH 密码登录
- 禁用键盘交互式认证
- 禁止 root 远程登录
- 保留基于公钥的管理登录

当前目标状态：

- 管理入口应通过普通管理员账号加密钥登录
- root 不应直接通过 SSH 登录

涉及文件：

- `/etc/ssh/sshd_config`

说明：

- 这台机器已经验证过管理员账号仍可通过密钥正常登录。
- 后续如使用腾讯云“在线重置密码”，需重新复核 SSH 配置。腾讯云控制台的密码重置流程可能把 `PasswordAuthentication` 改回启用状态并重载 `sshd`。

### 3.2 主机侧防火墙收口

已完成：

- 删除多余的历史放行端口
- 主机侧 `UFW` 收敛为仅保留必要公网入口

当前原则：

- 仅保留：
  - `22/tcp`：SSH
  - `80/tcp`：HTTP
  - `443/tcp`：HTTPS
  - 宝塔自定义管理端口

说明：

- 之前存在的 `20/21/888/8888/39000:40000` 已从主机防火墙移除。
- 云防火墙也应维持与主机防火墙一致的最小暴露面。

### 3.3 Fail2ban

已完成：

- 安装 `fail2ban`
- 启用 `sshd` jail
- 使用 `ufw` 作为封禁动作

涉及文件：

- `/etc/fail2ban/jail.d/10-sshd.local`

当前策略：

- `maxretry = 5`
- `findtime = 10m`
- `bantime = 1h`

### 3.4 系统补丁与自动更新

已完成：

- 更新软件源索引
- 执行一轮保守的安全补丁更新
- 完成一次受控重启
- 调整 unattended-upgrades 策略，明确允许安全更新源
- 保持自动更新但禁止自动重启

涉及文件：

- `/etc/apt/apt.conf.d/52-codex-auto-upgrades`
- `/etc/apt/apt.conf.d/52-codex-unattended-upgrades`

当前原则：

- 每日更新软件源索引
- 每日执行 unattended-upgrades
- 自动清理无用内核包和新产生的无用依赖
- 不自动重启服务器

### 3.5 非必要服务裁剪

已完成：

- 停用并禁用：
  - `ModemManager`
  - `udisks2`

说明：

- 这两项更偏桌面或热插拔场景，对当前公网服务器无明显业务价值。
- 清理后，SSH、Nginx、应用服务、Docker、Fail2ban 均保持正常。

### 3.6 文件权限与内核细节收口

已完成：

- 将以下文件权限从全局可写收紧为 `0644`：
  - `/etc/ssh/banner.txt`
  - `/etc/ssh/lockfile`
  - `/etc/uuid`
- 关闭 IPv4 重定向发送：
  - `net.ipv4.conf.all.send_redirects = 0`
  - `net.ipv4.conf.default.send_redirects = 0`

涉及文件：

- `/etc/sysctl.d/99-codex-hardening.conf`

## 4. 当前安全基线

### 4.1 网络与暴露面

当前确认的对外暴露原则如下：

- SSH：开启
- HTTP：开启
- HTTPS：开启
- 宝塔面板：保留自定义管理端口

当前服务结构：

- Nginx 对外提供网站入口
- Node.js 应用仅监听本地回环地址，由 Nginx 反向代理

IPv6 状态：

- 审计时未发现全局公网 IPv6 地址
- 仅见本地回环与链路本地地址
- 如后续云平台启用公网 IPv6，应重新复查一遍防火墙与监听策略

### 4.2 账号与认证

当前状态：

- root 远程登录已禁用
- SSH 密码登录已禁用
- 管理员账号使用公钥登录
- root 的本地 `authorized_keys` 未配置有效公钥

仍需注意：

- `ubuntu` 仍拥有 `NOPASSWD: ALL`
- `lighthouse` 仍拥有 `NOPASSWD: ALL`
- `lighthouse` 仍属于 `docker` 组

说明：

- `ubuntu` 是当前正常的管理登录账号。
- `lighthouse` 高概率与腾讯云轻量的一键登录或 OrcaTerm/WebShell 能力相关，当前未修改，以免影响云平台兜底入口。

### 4.3 日志与基础保护

当前已确认：

- `fail2ban`：启用
- `rsyslog`：启用
- `systemd-journald`：启用
- `logrotate`：启用
- `AppArmor`：启用且处于 enforce 状态

### 4.4 备份与恢复

当前已确认：

- 存在应用侧 SQLite 自动备份任务
- 存在宝塔备份产物
- 仓库内已有恢复手册与运维文档

但当前仍未确认：

- 是否存在稳定、定期、可恢复的异地备份
- 是否已将关键配置、数据库、证书、恢复包同步到对象存储或另一台主机

相关文档：

- `docs/server-ops.md`
- `docs/server-recovery-playbook.md`

## 5. 本次明确保留、未修改的项目

以下项目在本次整理中未直接收紧，属于已识别但暂缓处理：

### 5.1 `ubuntu` 的无密码 sudo

当前状态：

- `ubuntu` 仍可无密码执行 `sudo`

未立即修改的原因：

- 当前仍需保留较顺手的维护入口
- 一旦改为 `sudo` 必须输入本地密码，后续远程协助会增加维护摩擦

后续建议：

- 在后续维护稳定后，评估是否移除 `NOPASSWD: ALL`

### 5.2 `lighthouse` 的高权限与 Docker 组

当前状态：

- `lighthouse` 仍有高权限，且属于 `docker` 组

未立即修改的原因：

- 该账号大概率与腾讯云轻量管理链路相关
- 贸然锁定、去组或改 shell，可能影响云控制台登录兜底能力

后续建议：

- 若后续确认完全不依赖腾讯云控制台登录，再专项评估是否收紧

### 5.3 宝塔面板

当前确认：

- 已启用 SSL
- 已启用非默认随机安全入口
- 大概率已启用二次验证

当前缺口：

- 未配置 IP 白名单
- 未绑定专用面板域名

未立即修改的原因：

- 用户明确表示暂不继续折腾宝塔

## 6. 仍然存在的主要风险

按优先级从高到低概括如下：

1. `ubuntu` 的 `NOPASSWD: ALL`
2. `lighthouse` 的 `NOPASSWD: ALL` 与 `docker` 组成员身份
3. 宝塔面板缺少 IP 白名单
4. 备份更像本机备份，异地恢复能力未核实
5. 未部署更主动的文件完整性监控或主机审计工具

## 7. 当前未部署的能力

本次没有落地以下工具：

- `auditd`
- `aide`
- `rkhunter`
- `chkrootkit`
- `logwatch`
- `psad`
- `lynis`

原因：

- 本次优先级放在最小改动的基础加固与可用性保持
- 上述工具更适合在后续稳定窗口分批评估引入

## 8. 维护时的安全注意事项

### 8.1 不要在仓库里记录敏感值

禁止写入：

- 私钥
- 面板随机入口
- 各类 token
- 2FA 种子
- 管理员密码
- 云平台控制台截图中的敏感信息

### 8.2 调整 SSH 前必须保留一个已验证可用的登录会话

任何涉及以下配置的变更，都应先保留一个已验证可用的 SSH 会话：

- `PermitRootLogin`
- `PasswordAuthentication`
- `KbdInteractiveAuthentication`
- 防火墙放行规则

### 8.3 宝塔端口不应长期对全网裸放到更宽的范围

后续维护时应坚持：

- 不额外放开 FTP 历史端口
- 不把宝塔改回默认端口
- 如果有固定办公出口 IP，优先给宝塔做 IP 白名单

## 9. 建议的后续动作

建议按以下顺序推进：

1. 评估是否移除 `ubuntu` 的 `NOPASSWD: ALL`
2. 明确异地备份方案并做一次恢复演练
3. 给宝塔补 IP 白名单或更收口的管理入口策略
4. 若不再依赖腾讯云控制台兜底登录，专项评估 `lighthouse`
5. 视维护能力引入 `aide` 或 `lynis` 这类补充审计工具

## 10. 安全复核命令清单

以下命令可用于后续维护时快速复核，不含敏感输出：

```bash
sudo sshd -T | grep -Ei '^(permitrootlogin|passwordauthentication|pubkeyauthentication|kbdinteractiveauthentication)\\b'
sudo ufw status numbered
sudo fail2ban-client status
sudo fail2ban-client status sshd
sudo systemctl is-active ssh nginx fail2ban docker apparmor
sudo systemctl list-timers --all --no-pager | grep -E 'apt|logrotate|fstrim'
sudo ss -lntup
sudo sysctl net.ipv4.conf.all.send_redirects net.ipv4.conf.default.send_redirects
sudo crontab -l
df -h /
```

如需检查云防火墙，应在腾讯云控制台确认实际放行规则是否仍与主机侧最小暴露面一致。

## 11. 变更落点汇总

本次直接涉及或新增过的关键文件如下：

- `/etc/ssh/sshd_config`
- `/etc/fail2ban/jail.d/10-sshd.local`
- `/etc/apt/apt.conf.d/52-codex-auto-upgrades`
- `/etc/apt/apt.conf.d/52-codex-unattended-upgrades`
- `/etc/sysctl.d/99-codex-hardening.conf`

本次变更不包含业务代码逻辑调整，主要是服务器配置与运维基线整理。
