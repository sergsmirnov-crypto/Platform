/**
 * Полная очистка базы и заполнение заново.
 *
 * Запуск: pnpm db:reset
 *
 * ⚠️ Удаляет ВСЕ данные без возможности восстановления.
 * Нужна при разработке, когда база пришла в непонятное состояние.
 * На боевом сервере не работает — там это была бы катастрофа.
 */
import { execSync } from 'node:child_process'
import { loadEnvFile } from 'node:process'

import postgres from 'postgres'

try {
  loadEnvFile('.env')
} catch {
  // Переменные могут приходить из окружения
}

if (process.env.NODE_ENV === 'production') {
  console.error('Очистка базы в производственной среде запрещена.')
  process.exit(1)
}

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Не задано подключение к базе данных (DATABASE_URL).')
  process.exit(1)
}

const client = postgres(url, { max: 1, onnotice: () => {} })

try {
  console.log('Удаляю все таблицы…')
  // Пересоздание схемы разом надёжнее, чем удаление таблиц по одной:
  // не нужно помнить порядок из-за внешних ключей.
  await client.unsafe('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
  await client.unsafe('DROP SCHEMA IF EXISTS drizzle CASCADE;')
  await client.end()

  console.log('Применяю миграции…')
  execSync('pnpm run db:migrate', { stdio: 'inherit' })

  console.log('Заполняю базу…')
  execSync('pnpm run db:seed', { stdio: 'inherit' })

  console.log('\nГотово: база создана заново.')
} catch (error) {
  console.error('\nНе удалось пересоздать базу.')
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
