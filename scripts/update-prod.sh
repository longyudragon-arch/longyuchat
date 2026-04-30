#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/longyuchat/app}"
APP_USER="${APP_USER:-longyuchat}"
SERVICE_NAME="${SERVICE_NAME:-longyuchat}"
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

load_env_file() {
  local env_file="$1"

  if [[ -f "${env_file}" ]]; then
    set -a
    # shellcheck disable=SC1090
    . "${env_file}"
    set +a
  fi
}

load_env_file "${APP_DIR}/.env"
load_env_file "${APP_DIR}/.env.production"

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

health_check() {
  if [[ -n "${HEALTHCHECK_BEARER_TOKEN:-}" ]]; then
    curl -fsS -H "Authorization: Bearer ${HEALTHCHECK_BEARER_TOKEN}" "${HEALTH_URL}" >/dev/null
    return
  fi

  if [[ -n "${BASIC_AUTH_USERNAME:-}" && -n "${BASIC_AUTH_PASSWORD:-}" ]]; then
    curl -fsS -u "${BASIC_AUTH_USERNAME}:${BASIC_AUTH_PASSWORD}" "${HEALTH_URL}" >/dev/null
    return
  fi

  curl -fsS "${HEALTH_URL}" >/dev/null
}

echo "Running health check..."
for attempt in 1 2 3 4 5 6; do
  if health_check; then
    echo "Health check passed."
    echo
    echo "Production update completed successfully."
    exit 0
  fi

  if [[ "${attempt}" -lt 6 ]]; then
    echo "Health check attempt ${attempt} failed, retrying in 2 seconds..."
    sleep 2
  fi
done

echo "Health check failed after retries."
exit 1
