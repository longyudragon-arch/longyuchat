#!/usr/bin/env bash
set -euo pipefail

APP_USER="${APP_USER:-longyuchat}"
APP_GROUP="${APP_GROUP:-${APP_USER}}"
APP_LOG_DIR="${APP_LOG_DIR:-/srv/longyuchat/var/log}"
ROTATE_COUNT="${ROTATE_COUNT:-14}"
LOGROTATE_CONFIG_PATH="${LOGROTATE_CONFIG_PATH:-/etc/logrotate.d/longyuchat}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Please run this script as root."
  exit 1
fi

if ! command -v logrotate >/dev/null 2>&1; then
  echo "logrotate is not installed. Install it first with: sudo apt install -y logrotate"
  exit 1
fi

mkdir -p "${APP_LOG_DIR}"
chown "${APP_USER}:${APP_GROUP}" "${APP_LOG_DIR}"

cat > "${LOGROTATE_CONFIG_PATH}" <<EOF
${APP_LOG_DIR}/*.log {
    daily
    rotate ${ROTATE_COUNT}
    missingok
    notifempty
    compress
    delaycompress
    dateext
    copytruncate
    su ${APP_USER} ${APP_GROUP}
    create 0640 ${APP_USER} ${APP_GROUP}
}
EOF

logrotate -d "${LOGROTATE_CONFIG_PATH}" >/dev/null

echo "Installed logrotate config at ${LOGROTATE_CONFIG_PATH}."
echo "Log directory: ${APP_LOG_DIR}"
echo "Retention: ${ROTATE_COUNT} daily rotations"
