/**
 * Проверка файла .env без запуска приложения.
 *
 * Запуск: pnpm env:check
 *
 * Нужна прежде всего перед развёртыванием: показывает, какие настройки заданы,
 * а каких не хватает, — и не требует поднимать приложение целиком.
 * Секретные значения не печатаются, только факт их наличия.
 */
import { loadEnvFile } from 'node:process'

import { ENV_DESCRIPTIONS } from '../src/shared/config/env.descriptions'
import { parseServerEnv, serverEnvSchema } from '../src/shared/config/env.schema'

/** Переменные, значения которых нельзя выводить в консоль. */
const SECRETS = new Set([
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_WEBHOOK_SECRET',
  'SESSION_SECRET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'VIDEO_API_KEY',
  'DATABASE_URL',
  'SENTRY_DSN',
])

try {
  loadEnvFile('.env')
} catch {
  console.warn('Файл .env не найден — проверяю только переменные текущего окружения.\n')
}

const result = parseServerEnv(process.env)
const names = Object.keys(serverEnvSchema.shape).sort()

console.log('Настройки\n')
for (const name of names) {
  const raw = process.env[name]
  const isSet = typeof raw === 'string' && raw.trim() !== ''
  const shown = !isSet ? 'не задано' : SECRETS.has(name) ? 'задано (скрыто)' : raw
  console.log(`  ${isSet ? '·' : ' '} ${name.padEnd(26)} ${shown}`)
}

if (result.success) {
  console.log('\nВсё в порядке: приложение с такими настройками запустится.\n')
  process.exit(0)
}

console.log('\nПроблемы:\n')
for (const issue of result.issues) {
  console.log(`  ${issue.variable}`)
  console.log(`    ${issue.message}`)
  const description = ENV_DESCRIPTIONS[issue.variable]
  if (description) console.log(`    Что это: ${description}`)
  console.log('')
}
process.exit(1)
