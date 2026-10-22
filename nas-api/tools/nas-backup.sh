#!/bin/sh
# Nächtliche Sicherung von NUTRI auf der Synology (Aufgabenplaner, als root).
#
# Legt in <docker-Ordner>/nutri-backup/ ab:
#   db/nutri-DATUM.sql.gz   Datenbank-Export (die letzten 14 Tage bleiben)
#   files/                  Kopie aller Fotos (Volume nutri_files)
# Hyper Backup sichert den Ordner "docker" und damit auch dieses Backup.
#
# Liegt dieses Skript im Projektordner (z. B. /volume1/docker/nutri-api/), findet es .env und
# Ziel selbst. Abweichende Werte: PROJECT=... BACKUP_DIR=... sh nas-backup.sh

set -eu

DIR="$(cd "$(dirname "$0")" && pwd)"
# Skript darf im Projektordner oder in dessen Unterordner tools/ liegen.
[ -f "$DIR/.env" ] || DIR="$(dirname "$DIR")"
PROJECT="${PROJECT:-nutri-sw}"
BACKUP_DIR="${BACKUP_DIR:-$(dirname "$DIR")/nutri-backup}"
KEEP_DAYS="${KEEP_DAYS:-14}"

DB_PASSWORD="$(grep -E '^DB_PASSWORD=' "$DIR/.env" | head -n1 | cut -d= -f2- | tr -d '\r')"
[ -n "$DB_PASSWORD" ] || { echo "DB_PASSWORD in $DIR/.env nicht gefunden" >&2; exit 1; }

find_container() {
  docker ps -q \
    --filter "label=com.docker.compose.project=$PROJECT" \
    --filter "label=com.docker.compose.service=$1" | head -n1
}
DB="$(find_container db)"
API="$(find_container api)"
[ -n "$DB" ] || { echo "Datenbank-Container (Projekt $PROJECT) läuft nicht" >&2; exit 1; }
[ -n "$API" ] || { echo "API-Container (Projekt $PROJECT) läuft nicht" >&2; exit 1; }

mkdir -p "$BACKUP_DIR/db" "$BACKUP_DIR/files"

# 1) Datenbank: erst in eine .tmp-Datei, damit nie ein halbes Backup als fertig gilt.
OUT="$BACKUP_DIR/db/nutri-$(date +%Y-%m-%d_%H%M).sql.gz"
docker exec -e MYSQL_PWD="$DB_PASSWORD" "$DB" \
  mariadb-dump -unutri --single-transaction --routines --triggers nutri | gzip > "$OUT.tmp"
if [ ! -s "$OUT.tmp" ] || [ "$(wc -c < "$OUT.tmp")" -lt 2000 ]; then
  rm -f "$OUT.tmp"
  echo "Datenbank-Export ist leer oder zu klein, Backup abgebrochen" >&2
  exit 1
fi
mv "$OUT.tmp" "$OUT"

# 2) Fotos: komplette Kopie (überschreibt gleiche Dateien, entfernt nichts).
docker cp "$API:/data/storage/." "$BACKUP_DIR/files/"

# 3) Alte Datenbank-Exporte aufräumen.
find "$BACKUP_DIR/db" -name 'nutri-*.sql.gz' -mtime +"$KEEP_DAYS" -delete

echo "Backup fertig: $OUT ($(du -h "$OUT" | cut -f1)), Fotos: $(find "$BACKUP_DIR/files" -type f | wc -l) Dateien"
