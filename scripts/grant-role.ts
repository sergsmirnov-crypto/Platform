/**
 * Выдача роли участнику из командной строки.
 *
 * Запуск:
 *   pnpm role:grant <telegram_id> <роль>
 *
 * Роли: curator | senior_curator | admin | owner
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗАЧЕМ ЭТА КОМАНДА, ЕСЛИ РОЛИ ВЫДАЮТСЯ В ИНТЕРФЕЙСЕ
 *
 * Обычный путь — «Управление → Команда», и он остаётся основным.
 * Командная строка нужна ровно в двух случаях, и оба реальны:
 *
 * 1. Первый администратор. Раздел «Команда» доступен только тому,
 *    у кого уже есть право `users.roles`. Пока такого человека нет,
 *    выдать права некому — замкнутый круг. Обычно его разрывает
 *    переменная OWNER_TELEGRAM_ID при первом запуске, но она работает
 *    только в момент заполнения базы.
 *
 * 2. Владелец потерял доступ. Роль владельца неотзываема из интерфейса
 *    именно для того, чтобы её нельзя было снять по ошибке, — но если
 *    доступ всё же утрачен, восстановить его должно быть возможно
 *    тому, у кого есть доступ к серверу.
 *
 * Команда намеренно требует Telegram ID, а не имя: имена повторяются,
 * а ошибка здесь выдаёт человеку права на всю платформу.
 * ─────────────────────────────────────────────────────────────────
 *
 * Участник должен хотя бы раз войти на платформу — тогда у него есть
 * учётная запись. Исключение: роль владельца можно выдать «наперёд»,
 * учётная запись будет создана.
 */
import { loadEnvFile } from 'node:process'

import { eq, sql } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'

try {
  loadEnvFile('.env')
} catch {
  // На сервере переменные приходят из окружения
}

const { db } = await import('@/shared/db')
const schema = await import('@/shared/db/schema')

const KNOWN_ROLES = ['curator', 'senior_curator', 'admin', 'owner'] as const
type KnownRole = (typeof KNOWN_ROLES)[number]

const [telegramIdArg, roleArg] = process.argv.slice(2)

function fail(message: string): never {
  console.error(`\n${message}\n`)
  console.error('Использование: pnpm role:grant <telegram_id> <роль>')
  console.error(`Роли: ${KNOWN_ROLES.join(' | ')}`)
  console.error('Узнать Telegram ID участника: бот @userinfobot\n')
  process.exit(1)
}

const telegramId = telegramIdArg?.trim()
const role = roleArg?.trim() as KnownRole | undefined

if (!telegramId || !/^\d+$/.test(telegramId)) {
  fail('Не указан Telegram ID участника (это число, а не @username).')
}

if (!role || !KNOWN_ROLES.includes(role)) {
  fail(`Неизвестная роль: ${roleArg ?? '(не указана)'}`)
}

const [roleRow] = await db
  .select({ id: schema.roles.id, title: schema.roles.title })
  .from(schema.roles)
  .where(eq(schema.roles.code, role))
  .limit(1)

if (!roleRow) {
  fail('Роли в базе не найдены. Сначала выполните: pnpm db:seed')
}

const [identity] = await db
  .select({ userId: schema.authIdentities.userId })
  .from(schema.authIdentities)
  .where(
    sql`${schema.authIdentities.provider} = 'telegram'
        AND ${schema.authIdentities.providerUserId} = ${telegramId}`,
  )
  .limit(1)

let userId = identity?.userId

if (!userId) {
  if (role !== 'owner') {
    fail(
      `Участник с Telegram ID ${telegramId} не найден.\n` +
        'Он должен хотя бы раз войти на платформу — тогда появится учётная запись.\n' +
        'Создать наперёд можно только владельца.',
    )
  }

  const [created] = await db
    .insert(schema.users)
    .values({ id: uuidv7(), displayName: 'Владелец' })
    .returning({ id: schema.users.id })

  if (!created) fail('Не удалось создать учётную запись.')
  userId = created.id

  await db.insert(schema.authIdentities).values({
    id: uuidv7(),
    userId,
    provider: 'telegram',
    providerUserId: telegramId,
    isPrimary: true,
  })

  console.log('Создана учётная запись владельца.')
}

await db.insert(schema.userRoles).values({ userId, roleId: roleRow.id }).onConflictDoNothing()

// Владельцу доступ к содержимому не зависит от подписки: платформу
// нельзя потерять из-за неудачного списания
if (role === 'owner') {
  await db
    .insert(schema.entitlements)
    .values({ id: uuidv7(), userId, status: 'active', source: 'manual' })
    .onConflictDoNothing()
}

const [user] = await db
  .select({ name: schema.users.displayName })
  .from(schema.users)
  .where(eq(schema.users.id, userId))
  .limit(1)

console.log(`Готово: «${user?.name ?? 'участник'}» получил роль «${roleRow.title}».`)
console.log('Изменение вступает в силу при следующем открытии страницы.')

process.exit(0)
