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

UPLOADS_BACKUP_DIR="/opt/backups/uploads"
mkdir -p "${UPLOADS_BACKUP_DIR}"
UPLOADS_FILE="${UPLOADS_BACKUP_DIR}/uploads_${STAMP}.tar.gz"
if docker compose --env-file .env.proxmox exec -T backend tar -C /app/data -czf - uploads > "${UPLOADS_FILE}"; then
  find "${UPLOADS_BACKUP_DIR}" -type f -name '*.tar.gz' -mtime +"${RETENTION_DAYS}" -delete
  echo "Uploads backup completed: ${UPLOADS_FILE}"
else
  echo "Uploads backup skipped or failed" >&2
  rm -f "${UPLOADS_FILE}"
fi

echo "Backup completed: ${OUT_FILE}"
