#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /opt/backups/postgres/pgdump_xxx.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"
APP_DIR="/opt/car-service-ai-assistant"

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Backup file does not exist: ${BACKUP_FILE}"
  exit 1
fi

cd "${APP_DIR}"
source .env.proxmox

gunzip -c "${BACKUP_FILE}" | docker compose --env-file .env.proxmox exec -T db \
  psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"

echo "Restore completed from ${BACKUP_FILE}"
