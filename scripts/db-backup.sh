#!/usr/bin/env sh
#
# Резервная копия базы данных.
#
# Запускается по расписанию на сервере, раз в сутки:
#   0 3 * * * /путь/к/проекту/scripts/db-backup.sh
#
# Копии складываются локально и отправляются в S3. Локальные старше
# семи дней удаляются: место на сервере не резиновое, а долгое хранение —
# задача S3.
#
# ⚠️ Резервная копия, которую ни разу не разворачивали, резервной копией
# не является. Порядок проверки — в docs/OPERATIONS.md.

set -eu

BACKUP_DIR="${BACKUP_DIR:-/var/backups/guitar-club}"
KEEP_LOCAL_DAYS="${KEEP_LOCAL_DAYS:-7}"
STAMP=$(date +%Y-%m-%d_%H-%M)
FILE="$BACKUP_DIR/guitar-club_$STAMP.sql.gz"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Ошибка: не задано подключение к базе (DATABASE_URL)." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "Создаю копию: $FILE"

# Сначала выгрузка во временный файл, потом сжатие.
#
# Не одной командой через конвейер намеренно: в конвейере `pg_dump | gzip`
# оболочка возвращает код завершения последней команды, то есть gzip.
# Он отработает успешно даже если pg_dump упал, — и на сервере окажется
# исправный на вид архив с пустым содержимым. Обнаружилось бы это в день,
# когда копия понадобилась.
TMP="$BACKUP_DIR/.dump-in-progress.sql"
trap 'rm -f "$TMP"' EXIT

# --no-owner и --no-privileges — чтобы копию можно было развернуть
# на сервере, где пользователи базы называются иначе
if ! pg_dump "$DATABASE_URL" --no-owner --no-privileges > "$TMP"; then
  echo "Ошибка: не удалось выгрузить базу." >&2
  exit 1
fi

# Вторая проверка: выгрузка прошла, но данных нет.
BYTES=$(wc -c < "$TMP")
if [ "$BYTES" -lt 1024 ]; then
  echo "Ошибка: выгрузка подозрительно мала ($BYTES байт). Проверьте базу." >&2
  exit 1
fi

# Третья проверка: в копии есть содержательные команды, а не только заголовок
if ! grep -q "CREATE TABLE" "$TMP"; then
  echo "Ошибка: в копии нет ни одной таблицы. Проверьте базу." >&2
  exit 1
fi

gzip -9 -c "$TMP" > "$FILE"
echo "Готово, размер: $(du -h "$FILE" | cut -f1)"

if [ -n "${S3_BUCKET:-}" ] && command -v aws >/dev/null 2>&1; then
  echo "Отправляю в S3…"
  aws s3 cp "$FILE" "s3://$S3_BUCKET/backups/" --endpoint-url "$S3_ENDPOINT"
  echo "Отправлено."
else
  echo "S3 не настроен — копия осталась только на сервере."
fi

echo "Удаляю локальные копии старше $KEEP_LOCAL_DAYS дней…"
find "$BACKUP_DIR" -name 'guitar-club_*.sql.gz' -mtime "+$KEEP_LOCAL_DAYS" -delete

echo "Копия создана успешно."
