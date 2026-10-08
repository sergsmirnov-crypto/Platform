import 'server-only'

import { and, count, desc, eq, gte, isNull, lt, max, or, sql } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'

import { db } from '@/shared/db'

import { avatarUrlFor } from './avatar-url'
import { authIdentities, emailLoginCodes, users } from './schema'

import type { StoredCode } from './email-code-policy'
import type { IdentityWithUser } from './repository'

/**
 * Запросы ко входу по почте: коды и аккаунты, найденные по адресу.
 *
 * Отдельный файл, а не продолжение `repository.ts`: тот и так длинный,
 * а запросы входа меняются вместе с правилами входа, а не вместе
 * с профилем и каталогом участников.
 */

/** Когда отправлен последний код на адрес и сколько их было с момента `since` */
export async function findRecentCodeStats(
  email: string,
  since: Date,
): Promise<{ lastIssuedAt: Date | null; issuedLastHour: number }> {
  const [row] = await db
    .select({
      issued: count(),
      lastIssuedAt: max(emailLoginCodes.createdAt),
    })
    .from(emailLoginCodes)
    .where(and(eq(emailLoginCodes.email, email), gte(emailLoginCodes.createdAt, since)))

  return { lastIssuedAt: row?.lastIssuedAt ?? null, issuedLastHour: Number(row?.issued ?? 0) }
}

/**
 * Сохраняет новый код и гасит прежние коды этого адреса.
 *
 * Действует только последний код. Иначе в почте у человека три письма,
 * и он вводит код из первого — а мы молча принимаем любой из трёх,
 * утроив шансы того, кто подбирает.
 */
export async function replaceActiveCode(input: {
  id: string
  email: string
  codeHash: string
  expiresAt: Date
  ipHash: string | null
}): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(emailLoginCodes)
      .set({ consumedAt: new Date() })
      .where(and(eq(emailLoginCodes.email, input.email), isNull(emailLoginCodes.consumedAt)))

    await tx.insert(emailLoginCodes).values(input)
  })
}

/**
 * Убирает код, письмо с которым не ушло.
 *
 * Без этого неудачная отправка засчитывалась бы в паузу «повтор через
 * минуту», и человек ждал бы минуту ради письма, которого не будет
 */
export async function deleteCode(id: string): Promise<void> {
  await db.delete(emailLoginCodes).where(eq(emailLoginCodes.id, id))
}

/** Последний выданный код адреса, если он ещё не погашен */
export async function findActiveCode(email: string): Promise<StoredCode | null> {
  const [row] = await db
    .select({
      id: emailLoginCodes.id,
      codeHash: emailLoginCodes.codeHash,
      attempts: emailLoginCodes.attempts,
      expiresAt: emailLoginCodes.expiresAt,
      consumedAt: emailLoginCodes.consumedAt,
    })
    .from(emailLoginCodes)
    .where(and(eq(emailLoginCodes.email, email), isNull(emailLoginCodes.consumedAt)))
    .orderBy(desc(emailLoginCodes.createdAt))
    .limit(1)

  return row ?? null
}

/**
 * Засчитывает попытку и возвращает их число с учётом этой.
 *
 * Увеличение и чтение — одной командой: два одновременных запроса
 * не увидят одно и то же значение (см. `checkCode`).
 */
export async function registerCodeAttempt(id: string): Promise<number> {
  const [row] = await db
    .update(emailLoginCodes)
    .set({ attempts: sql`${emailLoginCodes.attempts} + 1` })
    .where(eq(emailLoginCodes.id, id))
    .returning({ attempts: emailLoginCodes.attempts })

  return row?.attempts ?? Number.POSITIVE_INFINITY
}

/**
 * Гасит код.
 *
 * @returns `true`, если код погасил именно этот вызов. Второй запрос
 *          с тем же кодом получит `false` — одним кодом не открыть две сессии
 */
export async function consumeCode(id: string): Promise<boolean> {
  const rows = await db
    .update(emailLoginCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(emailLoginCodes.id, id), isNull(emailLoginCodes.consumedAt)))
    .returning({ id: emailLoginCodes.id })

  return rows.length > 0
}

/**
 * Уборка: коды, истёкшие или погашенные раньше `before`.
 *
 * Хранить их дольше суток незачем — разбор «мне не пришёл код»
 * делается по журналу в тот же день.
 */
export async function deleteStaleCodes(before: Date): Promise<number> {
  const rows = await db
    .delete(emailLoginCodes)
    .where(or(lt(emailLoginCodes.expiresAt, before), lt(emailLoginCodes.consumedAt, before)))
    .returning({ id: emailLoginCodes.id })

  return rows.length
}

/** Ищет участника по адресу почты */
export async function findUserByEmail(email: string): Promise<IdentityWithUser | null> {
  const [row] = await db
    .select({
      userId: users.id,
      displayName: users.displayName,
      avatarId: users.avatarId,
      onboardingDoneAt: users.onboardingDoneAt,
      deletedAt: users.deletedAt,
      blockedAt: users.blockedAt,
    })
    .from(authIdentities)
    .innerJoin(users, eq(users.id, authIdentities.userId))
    .where(and(eq(authIdentities.provider, 'email'), eq(authIdentities.providerUserId, email)))
    .limit(1)

  if (!row || row.deletedAt !== null) return null

  return {
    userId: row.userId,
    user: {
      id: row.userId,
      displayName: row.displayName,
      avatarUrl: avatarUrlFor(row.userId, row.avatarId, 'sm'),
      onboardingDoneAt: row.onboardingDoneAt,
    },
    isBlocked: row.blockedAt !== null,
  }
}

/**
 * Создаёт участника со входом по почте.
 *
 * Адрес считается подтверждённым: аккаунт создаётся только после того,
 * как человек ввёл код из письма на этот адрес. Обе записи — в одной
 * транзакции, как и при входе через Telegram.
 */
export async function createUserWithEmailIdentity(
  email: string,
  displayName: string,
): Promise<IdentityWithUser> {
  const userId = uuidv7()
  const now = new Date()

  await db.transaction(async (tx) => {
    await tx.insert(users).values({ id: userId, displayName, lastSeenAt: now })

    await tx.insert(authIdentities).values({
      id: uuidv7(),
      userId,
      provider: 'email',
      providerUserId: email,
      isPrimary: true,
      verifiedAt: now,
    })
  })

  return {
    userId,
    user: { id: userId, displayName, avatarUrl: null, onboardingDoneAt: null },
    isBlocked: false,
  }
}

/** Адрес почты, с которым входит участник. Нужен экрану настроек */
export async function findEmailByUserId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ email: authIdentities.providerUserId })
    .from(authIdentities)
    .where(and(eq(authIdentities.userId, userId), eq(authIdentities.provider, 'email')))
    .limit(1)

  return row?.email ?? null
}
