#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/srv/agent-home}"
RUNTIME_ROOT="${RUNTIME_ROOT:-/srv/agent-home-runtime}"
OLD_DATA_DIR="${APP_ROOT}/data"
OLD_LOG_DIR="${APP_ROOT}/logs"
NEW_DATA_DIR="${RUNTIME_ROOT}/data"
NEW_LOG_DIR="${RUNTIME_ROOT}/logs"
SERVICE_USER="${SERVICE_USER:-www-data}"
SERVICE_GROUP="${SERVICE_GROUP:-www-data}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

echo_step() {
  echo
  echo "[agent-home] $1"
}

move_if_needed() {
  local source_path="$1"
  local target_path="$2"

  if [[ ! -e "${source_path}" ]]; then
    return 0
  fi

  if [[ -e "${target_path}" ]]; then
    echo "[agent-home] target already exists, skip: ${target_path}"
    return 0
  fi

  mv "${source_path}" "${target_path}"
  echo "[agent-home] moved ${source_path} -> ${target_path}"
}

backup_if_remaining() {
  local source_path="$1"

  if [[ ! -e "${source_path}" ]]; then
    return 0
  fi

  local backup_path="${source_path}.backup-${TIMESTAMP}"
  mv "${source_path}" "${backup_path}"
  echo "[agent-home] backup created: ${backup_path}"
}

main() {
  echo_step "preparing runtime directories"
  sudo mkdir -p "${NEW_DATA_DIR}" "${NEW_LOG_DIR}"

  echo_step "migrating sqlite database"
  move_if_needed "${OLD_DATA_DIR}/agent_home.sqlite" "${NEW_DATA_DIR}/agent_home.sqlite"

  echo_step "migrating app logs"
  if [[ -d "${OLD_LOG_DIR}" ]]; then
    shopt -s nullglob
    for log_file in "${OLD_LOG_DIR}"/*; do
      move_if_needed "${log_file}" "${NEW_LOG_DIR}/$(basename "${log_file}")"
    done
    shopt -u nullglob
  fi

  echo_step "backing up old directories when still present"
  if [[ -d "${OLD_DATA_DIR}" ]]; then
    backup_if_remaining "${OLD_DATA_DIR}"
  fi

  if [[ -d "${OLD_LOG_DIR}" ]]; then
    backup_if_remaining "${OLD_LOG_DIR}"
  fi

  echo_step "setting permissions"
  sudo chown -R "${SERVICE_USER}:${SERVICE_GROUP}" "${NEW_DATA_DIR}" "${NEW_LOG_DIR}"

  echo
  echo "[agent-home] migration completed"
  echo "[agent-home] database: ${NEW_DATA_DIR}/agent_home.sqlite"
  echo "[agent-home] logs: ${NEW_LOG_DIR}"
}

main "$@"
