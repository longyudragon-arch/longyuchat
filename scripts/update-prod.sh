#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/ai-chat-lab/app}"
APP_USER="${APP_USER:-ai-chat-lab}"
SERVICE_NAME="${SERVICE_NAME:-ai-chat-lab}"
REMOTE_NAME="${REMOTE_NAME:-origin}"
BACKUP_BEFORE_UPDATE="${BACKUP_BEFORE_UPDATE:-true}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Please run this script as root."
  exit 1
fi

if [[ ! -d "${APP_DIR}" ]]; then
  echo "App directory does not exist: ${APP_DIR}"
  exit 1
fi

run_as_app_user() {
  runuser -u "${APP_USER}" -- bash -lc "$1"
}

parse_boolean() {
  local raw_value
  raw_value="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"

  case "${raw_value}" in
    1|true|yes|on) return 0 ;;
    0|false|no|off) return 1 ;;
    *) return 1 ;;
  esac
}

if [[ -f "${APP_DIR}/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "${APP_DIR}/.env"
  set +a
fi

PORT="${PORT:-3000}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${PORT}/api/health}"

if parse_boolean "${BACKUP_BEFORE_UPDATE}" && [[ "${DATABASE_URL:-}" == file:* ]]; then
  echo "Creating a SQLite backup before update..."
  run_as_app_user "cd \"${APP_DIR}\" && npm run sqlite:backup"
fi

CURRENT_BRANCH="${BRANCH_NAME:-$(run_as_app_user "cd \"${APP_DIR}\" && git branch --show-current")}"

if [[ -z "${CURRENT_BRANCH}" ]]; then
  echo "Could not determine the current git branch. Set BRANCH_NAME explicitly."
  exit 1
fi

echo "Updating branch ${CURRENT_BRANCH} from ${REMOTE_NAME}..."
run_as_app_user "cd \"${APP_DIR}\" && git fetch \"${REMOTE_NAME}\""
run_as_app_user "cd \"${APP_DIR}\" && git checkout \"${CURRENT_BRANCH}\""
run_as_app_user "cd \"${APP_DIR}\" && git pull --ff-only \"${REMOTE_NAME}\" \"${CURRENT_BRANCH}\""

echo "Installing dependencies..."
run_as_app_user "cd \"${APP_DIR}\" && npm ci"

echo "Applying database migrations..."
run_as_app_user "cd \"${APP_DIR}\" && npm run prisma:migrate:deploy"

echo "Building the production bundle..."
run_as_app_user "cd \"${APP_DIR}\" && npm run build"

echo "Restarting ${SERVICE_NAME}..."
systemctl restart "${SERVICE_NAME}"
systemctl --no-pager --full status "${SERVICE_NAME}"

echo "Running health check..."
if [[ -n "${HEALTHCHECK_BEARER_TOKEN:-}" ]]; then
  curl -fsS -H "Authorization: Bearer ${HEALTHCHECK_BEARER_TOKEN}" "${HEALTH_URL}"
elif [[ -n "${BASIC_AUTH_USERNAME:-}" && -n "${BASIC_AUTH_PASSWORD:-}" ]]; then
  curl -fsS -u "${BASIC_AUTH_USERNAME}:${BASIC_AUTH_PASSWORD}" "${HEALTH_URL}"
else
  curl -fsS "${HEALTH_URL}"
fi

echo
echo "Production update completed successfully."
