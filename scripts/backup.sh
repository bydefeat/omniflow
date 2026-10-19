#!/usr/bin/env bash
# Sao lưu database (và thư mục uploads/ nếu lưu tệp trên đĩa). Giữ bản sao lưu trong BACKUP_KEEP_DAYS ngày.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/omniflow}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"

if [[ -z "${DEFEAT_POSTGRES_PRIMARY_DATABASE_CONNECTION_URL:-}" && -f "$APP_DIR/.env" ]]; then
  DEFEAT_POSTGRES_PRIMARY_DATABASE_CONNECTION_URL="$(grep -E '^DEFEAT_POSTGRES_PRIMARY_DATABASE_CONNECTION_URL=' "$APP_DIR/.env" | cut -d= -f2-)"
fi
: "${DEFEAT_POSTGRES_PRIMARY_DATABASE_CONNECTION_URL:?Thiếu DEFEAT_POSTGRES_PRIMARY_DATABASE_CONNECTION_URL}"

mkdir -p "$BACKUP_DIR"
stamp="$(date +%Y%m%d-%H%M%S)"

pg_dump --format=custom --no-owner --file="$BACKUP_DIR/omniflow-$stamp.dump" "$DEFEAT_POSTGRES_PRIMARY_DATABASE_CONNECTION_URL"
echo "Đã sao lưu database: $BACKUP_DIR/omniflow-$stamp.dump"

if [[ -d "$APP_DIR/uploads" ]]; then
  tar -czf "$BACKUP_DIR/uploads-$stamp.tar.gz" -C "$APP_DIR" uploads
  echo "Đã sao lưu tệp đính kèm: $BACKUP_DIR/uploads-$stamp.tar.gz"
fi

find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'omniflow-*.dump' -o -name 'uploads-*.tar.gz' \) -mtime "+$BACKUP_KEEP_DAYS" -delete
