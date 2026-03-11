#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/ai-chat-lab/app}"
APP_USER="${APP_USER:-ai-chat-lab}"
APP_LOG_DIR="${APP_LOG_DIR:-/srv/ai-chat-lab/var/log}"
BACKUP_HOUR="${BACKUP_HOUR:-3}"
BACKUP_MINUTE="${BACKUP_MINUTE:-30}"
CRON_MARKER="# ai-chat-lab sqlite backup"
CRON_COMMAND="${BACKUP_MINUTE} ${BACKUP_HOUR} * * * cd ${APP_DIR} && /usr/bin/npm run sqlite:backup >> ${APP_LOG_DIR}/sqlite-backup.log 2>&1"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Please run this script as root."
  exit 1
fi

if [[ ! -d "${APP_DIR}" ]]; then
  echo "App directory does not exist: ${APP_DIR}"
  exit 1
fi

if ! command -v crontab >/dev/null 2>&1; then
  echo "crontab is not installed on this server."
  exit 1
fi

mkdir -p "${APP_LOG_DIR}"
chown "${APP_USER}:${APP_USER}" "${APP_LOG_DIR}"

CURRENT_CRONTAB="$(mktemp)"
trap 'rm -f "${CURRENT_CRONTAB}"' EXIT

crontab -u "${APP_USER}" -l 2>/dev/null | grep -v "ai-chat-lab sqlite backup" | grep -v "/usr/bin/npm run sqlite:backup" > "${CURRENT_CRONTAB}" || true

{
  cat "${CURRENT_CRONTAB}"
  echo "${CRON_MARKER}"
  echo "${CRON_COMMAND}"
} | crontab -u "${APP_USER}" -

echo "Installed SQLite backup cron job for user ${APP_USER}."
echo "Schedule: ${BACKUP_HOUR}:${BACKUP_MINUTE} every day."
echo "App directory: ${APP_DIR}"
echo "Log file: ${APP_LOG_DIR}/sqlite-backup.log"
