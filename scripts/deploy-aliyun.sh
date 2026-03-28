#!/usr/bin/env bash
set -euo pipefail

SERVER_IP="${SERVER_IP:-118.31.59.247}"
APP_ROOT="${APP_ROOT:-/srv/agent-home}"
RUNTIME_ROOT="${RUNTIME_ROOT:-/srv/agent-home-runtime}"
BACKEND_ROOT="${APP_ROOT}/backend"
FRONTEND_ROOT="${APP_ROOT}/frontend"
DATA_DIR="${RUNTIME_ROOT}/data"
APP_LOG_DIR="${RUNTIME_ROOT}/logs"
SYSTEM_LOG_DIR="${SYSTEM_LOG_DIR:-/var/log/agent-home}"
SYSTEMD_SERVICE_PATH="${SYSTEMD_SERVICE_PATH:-/etc/systemd/system/agent-home-backend.service}"
NGINX_SITE_PATH="${NGINX_SITE_PATH:-/etc/nginx/sites-available/agent-home.conf}"
NGINX_SITE_LINK="${NGINX_SITE_LINK:-/etc/nginx/sites-enabled/agent-home.conf}"
SERVICE_USER="${SERVICE_USER:-www-data}"
SERVICE_GROUP="${SERVICE_GROUP:-www-data}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[agent-home] missing required command: $1" >&2
    exit 1
  fi
}

install_packages() {
  if command -v dnf >/dev/null 2>&1; then
    sudo dnf --disablerepo=docker-ce-stable install -y "$@" || sudo dnf install -y "$@"
    return
  fi

  if command -v yum >/dev/null 2>&1; then
    sudo yum --disablerepo=docker-ce-stable install -y "$@" || sudo yum install -y "$@"
    return
  fi

  if command -v apt >/dev/null 2>&1; then
    sudo apt update
    sudo apt install -y "$@"
    return
  fi

  echo "[agent-home] unsupported package manager" >&2
  exit 1
}

echo_step() {
  echo
  echo "[agent-home] $1"
}

write_backend_env() {
  cat >"${BACKEND_ROOT}/.env.production" <<EOF
PORT=3001
HOST=0.0.0.0
CORS_ORIGIN=http://${SERVER_IP}
AGENT_HOME_DB_PATH=${DATA_DIR}/agent_home.sqlite
AGENT_HOME_LOG_DIR=${APP_LOG_DIR}
LOG_RETENTION_DAYS=3
EOF
}

write_frontend_env() {
  cat >"${FRONTEND_ROOT}/.env.production" <<EOF
VITE_API_BASE_URL=http://${SERVER_IP}
EOF
}

main() {
  require_command sudo
  require_command cp
  require_command ln
  require_command rm
  require_command sed

  echo_step "checking project path"
  if [[ ! -d "${BACKEND_ROOT}" || ! -d "${FRONTEND_ROOT}" ]]; then
    echo "[agent-home] project not found under ${APP_ROOT}" >&2
    echo "[agent-home] upload the repo to ${APP_ROOT} first" >&2
    exit 1
  fi

  echo_step "installing runtime packages"
  install_packages nginx curl

  if ! command -v node >/dev/null 2>&1; then
    echo "[agent-home] node is not installed. install Node.js 20+ manually first." >&2
    exit 1
  fi

  require_command node
  require_command npm
  require_command nginx
  require_command systemctl
  require_command curl

  echo_step "preparing directories"
  sudo mkdir -p "${APP_ROOT}" "${RUNTIME_ROOT}" "${DATA_DIR}" "${APP_LOG_DIR}" "${SYSTEM_LOG_DIR}"
  sudo chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "${DATA_DIR}" "${APP_LOG_DIR}" "${SYSTEM_LOG_DIR}"

  echo_step "writing production env files"
  write_backend_env
  write_frontend_env

  echo_step "installing backend dependencies"
  (
    cd "${BACKEND_ROOT}"
    npm install --production
  )

  echo_step "installing frontend dependencies and building"
  (
    cd "${FRONTEND_ROOT}"
    npm install
    npm run build
  )

  echo_step "installing systemd service"
  sudo cp "${APP_ROOT}/deploy/systemd/agent-home-backend.service" "${SYSTEMD_SERVICE_PATH}"
  sudo sed -i "s/^User=.*/User=${SERVICE_USER}/" "${SYSTEMD_SERVICE_PATH}"
  sudo sed -i "s/^Group=.*/Group=${SERVICE_GROUP}/" "${SYSTEMD_SERVICE_PATH}"
  sudo systemctl daemon-reload
  sudo systemctl enable agent-home-backend
  sudo systemctl restart agent-home-backend

  echo_step "installing nginx site"
  sudo cp "${APP_ROOT}/deploy/nginx/agent-home.conf" "${NGINX_SITE_PATH}"
  sudo ln -sf "${NGINX_SITE_PATH}" "${NGINX_SITE_LINK}"
  sudo rm -f /etc/nginx/sites-enabled/default
  sudo nginx -t
  sudo systemctl reload nginx

  echo_step "running health checks"
  curl http://127.0.0.1:3001/api/health
  echo
  curl -I "http://${SERVER_IP}"

  echo
  echo "[agent-home] deploy completed"
  echo "[agent-home] runtime data: ${DATA_DIR}"
  echo "[agent-home] open http://${SERVER_IP}/#/"
}

main "$@"
