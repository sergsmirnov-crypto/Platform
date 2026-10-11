#!/usr/bin/env sh
#
# Восстановление базы из резервной копии.
#
#   ./scripts/db-restore.sh /var/backups/guitar-club/guitar-club_2026-08-07_03-00.sql.gz
#
# ⚠️ ПОЛНОСТЬЮ ЗАМЕЩАЕТ содержимое базы, указанной в DATABASE_URL.
# Перед запуском убедитесь, что это та база, которую вы собираетесь заменить.

set -eu

FILE="${1:-}"

if [ -z "$FILE" ]; then
  echo "Укажите файл копии: ./scripts/db-restore.sh <файл.sql.gz>" >&2
  exit 1
fi

if [ ! -f "$FILE" ]; then
  echo "Файл не найден: $FILE" >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Ошибка: не задано подключение к базе (DATABASE_URL)." >&2
  exit 1
fi

echo "Восстанавливаю базу из: $FILE"
echo "Целевая база: $(echo "$DATABASE_URL" | sed 's|://[^@]*@|://***@|')"

if [ "${FORCE:-}" != "1" ]; then
  printf 'Всё содержимое базы будет заменено. Продолжить? [yes/N] '
  read -r ANSWER
  [ "$ANSWER" = "yes" ] || { echo "Отменено."; exit 1; }
fi

echo "Очищаю базу…"
psql "$DATABASE_URL" -q -c 'DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;'
psql "$DATABASE_URL" -q -c 'DROP SCHEMA IF EXISTS pgboss CASCADE;' 2>/dev/null || true
psql "$DATABASE_URL" -q -c 'DROP SCHEMA IF EXISTS drizzle CASCADE;' 2>/dev/null || true

echo "Загружаю данные…"
gunzip -c "$FILE" | psql "$DATABASE_URL" -q

echo "Готово. Проверьте, что платформа открывается и данные на месте."
