/**
 * Первоначальное заполнение базы.
 *
 * Запуск: pnpm db:seed
 *
 * Создаёт справочник прав, системные роли и владельца платформы.
 * Команду можно запускать сколько угодно раз: существующие записи
 * обновляются, а не дублируются. Это важно — после добавления нового права
 * достаточно запустить её снова.
 */
import { loadEnvFile } from 'node:process'

import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { v7 as uuidv7 } from 'uuid'

import { PERMISSIONS } from '../src/modules/access/permissions.catalog'
import { OWNER_ROLE_CODE, ROLES } from '../src/modules/access/roles.catalog'
// Каталог, а не публичный вход модуля: тот тянет серверный код Next.js,
// который в обычном скрипте не запускается
import { SETTING_KEYS } from '../src/modules/settings/catalog'
import * as schema from '../src/shared/db/schema'

try {
  loadEnvFile('.env')
} catch {
  // На боевом сервере переменные приходят из окружения
}

const url = process.env.DATABASE_URL
if (!url) {
  console.error('Не задано подключение к базе данных (DATABASE_URL).')
  process.exit(1)
}

const client = postgres(url, { max: 1, onnotice: () => {} })
const db = drizzle(client, { schema })

async function seedPermissions(): Promise<void> {
  for (const permission of PERMISSIONS) {
    await db
      .insert(schema.permissions)
      .values({
        key: permission.key,
        groupKey: permission.groupKey,
        title: permission.title,
        description: permission.description ?? null,
        isScoped: permission.isScoped ?? false,
        isSensitive: permission.isSensitive ?? false,
      })
      .onConflictDoUpdate({
        target: schema.permissions.key,
        set: {
          groupKey: permission.groupKey,
          title: permission.title,
          description: permission.description ?? null,
          isScoped: permission.isScoped ?? false,
          isSensitive: permission.isSensitive ?? false,
        },
      })
  }
  console.log(`  права: ${PERMISSIONS.length}`)
}

async function seedRoles(): Promise<void> {
  for (const role of ROLES) {
    const [saved] = await db
      .insert(schema.roles)
      .values({
        id: uuidv7(),
        code: role.code,
        title: role.title,
        description: role.description,
        isSystem: true,
        orderIndex: role.orderIndex,
      })
      .onConflictDoUpdate({
        target: schema.roles.code,
        set: { title: role.title, description: role.description, orderIndex: role.orderIndex },
      })
      .returning({ id: schema.roles.id })

    if (!saved) continue

    /**
     * Права роли переписываются целиком.
     *
     * Так изменение пресета в коде всегда доходит до базы: если право
     * из пресета убрали, оно должно исчезнуть и здесь. Персональные
     * исключения участников при этом не затрагиваются — они в другой таблице.
     */
    await db.delete(schema.rolePermissions).where(eq(schema.rolePermissions.roleId, saved.id))

    const entries = Object.entries(role.permissions)
    if (entries.length > 0) {
      await db.insert(schema.rolePermissions).values(
        entries.map(([permissionKey, scope]) => ({
          roleId: saved.id,
          permissionKey,
          scope,
        })),
      )
    }

    console.log(`  роль «${role.title}»: ${entries.length} прав`)
  }
}

async function seedOwner(): Promise<void> {
  const ownerTelegramId = process.env.OWNER_TELEGRAM_ID?.trim()

  if (!ownerTelegramId) {
    console.log('  владелец: пропущено (не задан OWNER_TELEGRAM_ID)')
    return
  }

  const existing = await db
    .select({ userId: schema.authIdentities.userId })
    .from(schema.authIdentities)
    .where(
      sql`${schema.authIdentities.provider} = 'telegram' AND ${schema.authIdentities.providerUserId} = ${ownerTelegramId}`,
    )
    .limit(1)

  let userId = existing[0]?.userId

  if (!userId) {
    const [created] = await db
      .insert(schema.users)
      .values({ id: uuidv7(), displayName: 'Владелец' })
      .returning({ id: schema.users.id })

    if (!created) throw new Error('Не удалось создать пользователя-владельца')
    userId = created.id

    await db.insert(schema.authIdentities).values({
      id: uuidv7(),
      userId,
      provider: 'telegram',
      providerUserId: ownerTelegramId,
      isPrimary: true,
    })

    console.log(`  владелец: создан (Telegram ID ${ownerTelegramId})`)
  } else {
    console.log(`  владелец: уже существует (Telegram ID ${ownerTelegramId})`)
  }

  const [ownerRole] = await db
    .select({ id: schema.roles.id })
    .from(schema.roles)
    .where(eq(schema.roles.code, OWNER_ROLE_CODE))
    .limit(1)

  if (!ownerRole) throw new Error('Роль владельца не найдена')

  await db.insert(schema.userRoles).values({ userId, roleId: ownerRole.id }).onConflictDoNothing()

  // Владельцу доступ не выдаётся подпиской: он не должен потерять
  // платформу из-за проблем с оплатой.
  await db
    .insert(schema.entitlements)
    .values({ id: uuidv7(), userId, status: 'active', source: 'manual' })
    .onConflictDoNothing()
}

/**
 * Карточки переходов в чаты Telegram на главной.
 *
 * Заполняются один раз при первом запуске и дальше правятся из интерфейса
 * (Этап 9). Адреса — заглушки: настоящие подставит владелец клуба.
 */
async function seedSettings() {
  const existing = await db
    .select({ key: schema.appSettings.key })
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, SETTING_KEYS.telegramChats))
    .limit(1)

  if (existing.length > 0) {
    console.log('  настройки: уже заданы')
    return
  }

  await db.insert(schema.appSettings).values({
    key: SETTING_KEYS.telegramChats,
    description: 'Карточки переходов в чаты Telegram на главной',
    value: [
      {
        title: 'Общий чат клуба',
        description: 'Живое общение, обмен записями, знакомства',
        url: 'https://t.me/',
      },
      {
        title: 'Вопросы кураторам',
        description: 'Не получается такт — спросите здесь',
        url: 'https://t.me/',
      },
      {
        title: 'Идеи и предложения',
        description: 'Какую песню разобрать следующей',
        url: 'https://t.me/',
      },
    ],
  })

  console.log('  настройки: заданы значения по умолчанию')
}

try {
  console.log('Заполняю базу…')
  await seedPermissions()
  await seedRoles()
  await seedOwner()
  await seedSettings()
  console.log('Готово.')
} catch (error) {
  console.error('\nНе удалось заполнить базу.')
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
} finally {
  await client.end()
}
