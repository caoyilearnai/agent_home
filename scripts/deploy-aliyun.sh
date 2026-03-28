#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-deploy}"

SERVER_IP="${SERVER_IP:-118.31.59.247}"
APP_ROOT="${APP_ROOT:-/srv/agent-home}"
RUNTIME_ROOT="${RUNTIME_ROOT:-/srv/agent-home-runtime}"
BACKEND_ROOT="${APP_ROOT}/backend"
FRONTEND_ROOT="${APP_ROOT}/frontend"
DATA_DIR="${RUNTIME_ROOT}/data"
APP_LOG_DIR="${RUNTIME_ROOT}/logs"
SYSTEM_LOG_DIR="${SYSTEM_LOG_DIR:-/var/log/agent-home}"
SYSTEMD_SERVICE_PATH="${SYSTEMD_SERVICE_PATH:-/etc/systemd/system/agent-home-backend.service}"
NGINX_CONF_PATH="${NGINX_CONF_PATH:-/etc/nginx/conf.d/agent-home.conf}"
SERVICE_NAME="${SERVICE_NAME:-agent-home-backend}"
SERVICE_USER="${SERVICE_USER:-admin}"
SERVICE_GROUP="${SERVICE_GROUP:-admin}"

TMP_ROOT="${TMP_ROOT:-/tmp/agent-home-update}"
REPO_OWNER="${REPO_OWNER:-caoyilearnai}"
REPO_NAME="${REPO_NAME:-agent_home}"
REPO_BRANCH="${REPO_BRANCH:-main}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

ARCHIVE_URL="https://codeload.github.com/${REPO_OWNER}/${REPO_NAME}/tar.gz/refs/heads/${REPO_BRANCH}"
ARCHIVE_PATH="${TMP_ROOT}/agent-home.tar.gz"
EXTRACT_ROOT="${TMP_ROOT}/extract"
EXTRACTED_APP_DIR="${EXTRACT_ROOT}/${REPO_NAME}-${REPO_BRANCH}"
BACKUP_ROOT="${TMP_ROOT}/backup-${TIMESTAMP}"

echo_step() {
  echo
  echo "[agent-home] $1"
}

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

write_nginx_conf() {
  sudo tee "${NGINX_CONF_PATH}" >/dev/null <<EOF
server {
    listen 80;
    server_name ${SERVER_IP};

    root ${FRONTEND_ROOT}/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
}

install_backend_dependencies() {
  echo_step "installing backend dependencies"
  (
    cd "${BACKEND_ROOT}"
    npm install --production
  )
}

install_frontend_dependencies_and_build() {
  echo_step "installing frontend dependencies and building"
  (
    cd "${FRONTEND_ROOT}"
    npm install
    npm run build
  )
}

install_or_refresh_systemd() {
  echo_step "installing systemd service"
  sudo cp "${APP_ROOT}/deploy/systemd/agent-home-backend.service" "${SYSTEMD_SERVICE_PATH}"
  sudo sed -i "s|^WorkingDirectory=.*|WorkingDirectory=${BACKEND_ROOT}|" "${SYSTEMD_SERVICE_PATH}"
  sudo sed -i "s|^EnvironmentFile=.*|EnvironmentFile=${BACKEND_ROOT}/.env.production|" "${SYSTEMD_SERVICE_PATH}"
  sudo sed -i "s|^User=.*|User=${SERVICE_USER}|" "${SYSTEMD_SERVICE_PATH}"
  sudo sed -i "s|^Group=.*|Group=${SERVICE_GROUP}|" "${SYSTEMD_SERVICE_PATH}"
  sudo systemctl daemon-reload
  sudo systemctl enable "${SERVICE_NAME}"
  sudo systemctl restart "${SERVICE_NAME}"
}

install_or_refresh_nginx() {
  echo_step "installing nginx site"
  write_nginx_conf
  sudo nginx -t
  sudo systemctl reload nginx
}

run_health_checks() {
  echo_step "running health checks"
  curl http://127.0.0.1:3001/api/health
  echo
  curl -I "http://${SERVER_IP}"
}

backup_env_if_exists() {
  local source_file="$1"
  local target_dir="$2"

  if [[ -f "${source_file}" ]]; then
    mkdir -p "${target_dir}"
    sudo cp "${source_file}" "${target_dir}/"
  fi
}

restore_env_if_exists() {
  local backup_file="$1"
  local target_file="$2"

  if [[ -f "${backup_file}" ]]; then
    sudo mkdir -p "$(dirname "${target_file}")"
    sudo cp "${backup_file}" "${target_file}"
    sudo chown "${SERVICE_USER}:${SERVICE_GROUP}" "${target_file}"
  fi
}

prepare_runtime() {
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

  echo_step "preparing runtime directories"
  sudo mkdir -p "${APP_ROOT}" "${RUNTIME_ROOT}" "${DATA_DIR}" "${APP_LOG_DIR}" "${SYSTEM_LOG_DIR}"
  sudo chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "${DATA_DIR}" "${APP_LOG_DIR}" "${SYSTEM_LOG_DIR}"
}

run_deploy() {
  echo_step "checking project path"
  if [[ ! -d "${BACKEND_ROOT}" || ! -d "${FRONTEND_ROOT}" ]]; then
    echo "[agent-home] project not found under ${APP_ROOT}" >&2
    echo "[agent-home] upload the repo to ${APP_ROOT} first" >&2
    exit 1
  fi

  prepare_runtime

  echo_step "writing production env files"
  write_backend_env
  write_frontend_env

  install_backend_dependencies
  install_frontend_dependencies_and_build
  install_or_refresh_systemd
  install_or_refresh_nginx
  run_health_checks

  echo
  echo "[agent-home] deploy completed"
  echo "[agent-home] runtime data: ${DATA_DIR}"
  echo "[agent-home] open http://${SERVER_IP}/#/"
}

run_update() {
  require_command curl
  require_command tar
  require_command rm
  require_command mv
  require_command cp
  require_command npm
  require_command sudo
  require_command systemctl
  require_command nginx

  echo_step "checking current app path"
  if [[ ! -d "${BACKEND_ROOT}" || ! -d "${FRONTEND_ROOT}" ]]; then
    echo "[agent-home] app root is invalid: ${APP_ROOT}" >&2
    exit 1
  fi

  echo_step "preparing temp workspace"
  rm -rf "${TMP_ROOT}"
  mkdir -p "${TMP_ROOT}" "${EXTRACT_ROOT}" "${BACKUP_ROOT}"

  echo_step "backing up env files"
  backup_env_if_exists "${BACKEND_ROOT}/.env.production" "${BACKUP_ROOT}/backend"
  backup_env_if_exists "${FRONTEND_ROOT}/.env.production" "${BACKUP_ROOT}/frontend"

  echo_step "downloading latest code from codeload"
  curl -L "${ARCHIVE_URL}" -o "${ARCHIVE_PATH}"

  echo_step "extracting release package"
  tar -xzf "${ARCHIVE_PATH}" -C "${EXTRACT_ROOT}"

  if [[ ! -d "${EXTRACTED_APP_DIR}" ]]; then
    echo "[agent-home] extracted app dir not found: ${EXTRACTED_APP_DIR}" >&2
    exit 1
  fi

  echo_step "restoring env files into new code"
  restore_env_if_exists "${BACKUP_ROOT}/backend/.env.production" "${EXTRACTED_APP_DIR}/backend/.env.production"
  restore_env_if_exists "${BACKUP_ROOT}/frontend/.env.production" "${EXTRACTED_APP_DIR}/frontend/.env.production"

  echo_step "replacing app code directory"
  if [[ -d "${APP_ROOT}" ]]; then
    sudo mv "${APP_ROOT}" "${APP_ROOT}.backup-${TIMESTAMP}"
  fi
  sudo mv "${EXTRACTED_APP_DIR}" "${APP_ROOT}"
  sudo chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "${APP_ROOT}"

  install_backend_dependencies
  install_frontend_dependencies_and_build
  install_or_refresh_systemd
  install_or_refresh_nginx

  echo_step "running health checks"
  curl http://127.0.0.1:3001/api/health

  echo
  echo "[agent-home] update completed"
  echo "[agent-home] runtime data preserved at: ${RUNTIME_ROOT}"
  echo "[agent-home] code backup: ${APP_ROOT}.backup-${TIMESTAMP}"
  echo "[agent-home] open http://${SERVER_IP}/#/"
}

main() {
  require_command sudo
  require_command sed

  case "${MODE}" in
    deploy)
      run_deploy
      ;;
    update)
      run_update
      ;;
    *)
      echo "Usage: bash scripts/deploy-aliyun.sh [deploy|update]" >&2
      exit 1
      ;;
  esac
}

main "$@"
