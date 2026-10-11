/**
 * Применение миграций базы данных.
 *
 * Запуск: pnpm db:migrate
 *
 * Миграции применяются по порядку, каждая ровно один раз. Уже применённые
 * пропускаются — команду можно запускать сколько угодно раз безопасно.
 * На боевом сервере она выполняется перед запуском новой версии приложения.
 */
import { loadEnvFile } from 'node:process'

import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

try {
  loadEnvFile('.env')
} catch {
  // На боевом сервере переменные приходят из окружения, файла .env нет
}

const url = process.env.DATABASE_URL

if (!url) {
  console.error(
    'Не задано подключение к базе данных (DATABASE_URL).\n' +
      'Проверьте файл .env. База поднимается командой: docker compose up -d',
  )
  process.exit(1)
}

// Отдельное соединение только на время миграции: max: 1 гарантирует,
// что команды выполнятся строго по очереди.
const client = postgres(url, {
  max: 1,
  // PostgreSQL шлёт служебные уведомления вида «схема уже существует».
  // Они безобидны, но выглядят как ошибка — прячем их.
  onnotice: () => {},
})

try {
  console.log('Применяю миграции…')
  await migrate(drizzle(client), { migrationsFolder: './drizzle' })
  console.log('Готово: база приведена к актуальному состоянию.')
} catch (error) {
  console.error('\nНе удалось применить миграции.')
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
} finally {
  await client.end()
}
