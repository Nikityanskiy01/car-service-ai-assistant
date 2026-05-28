#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/car-service-ai-assistant"
BACKUP_DIR="/opt/backups/postgres"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

cd "${APP_DIR}"
source .env.proxmox

mkdir -p "${BACKUP_DIR}"
STAMP="$(date +%F_%H-%M-%S)"
OUT_FILE="${BACKUP_DIR}/pgdump_${POSTGRES_DB}_${STAMP}.sql.gz"

docker compose --env-file .env.proxmox exec -T db \
  pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" | gzip > "${OUT_FILE}"

find "${BACKUP_DIR}" -type f -name '*.sql.gz' -mtime +"${RETENTION_DAYS}" -delete

echo "Backup completed: ${OUT_FILE}"
