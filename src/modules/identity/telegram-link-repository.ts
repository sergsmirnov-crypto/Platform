import 'server-only'

import { and, eq, isNull, lt, or } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'

import { db } from '@/shared/db'

import { authIdentities, telegramLinkTokens, users } from './schema'

/**
 * Запросы к подключению Telegram: одноразовые ключи и привязка аккаунта.
 */

export async function insertLinkToken(input: {
  userId: string
  tokenHash: string
  expiresAt: Date
}): Promise<void> {
  await db.insert(telegramLinkTokens).values({ id: uuidv7(), ...input })
}

export type StoredLinkToken = {
  id: string
  userId: string
  expiresAt: Date
  usedAt: Date | null
}

export async function findLinkToken(tokenHash: string): Promise<StoredLinkToken | null> {
  const [row] = await db
    .select({
      id: telegramLinkTokens.id,
      userId: telegramLinkTokens.userId,
      expiresAt: telegramLinkTokens.expiresAt,
      usedAt: telegramLinkTokens.usedAt,
    })
    .from(telegramLinkTokens)
    .where(eq(telegramLinkTokens.tokenHash, tokenHash))
    .limit(1)

  return row ?? null
}

/**
 * Отмечает ключ использованным.
 *
 * @returns `true`, если отметил именно этот вызов: повторная доставка
 *          того же «Старт» не привяжет Telegram дважды
 */
export async function markLinkTokenUsed(id: string): Promise<boolean> {
  const rows = await db
    .update(telegramLinkTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(telegramLinkTokens.id, id), isNull(telegramLinkTokens.usedAt)))
    .returning({ id: telegramLinkTokens.id })

  return rows.length > 0
}

/**
 * Привязывает Telegram к участнику.
 *
 * Имя из Telegram подставляется, только если человек своего ещё не задал:
 * новичок, вошедший по почте, зовётся «Участник клуба», и знакомство
 * лучше начать с его настоящего имени. Имя, которое человек выбрал сам,
 * не трогается никогда.
 */
export async function attachTelegramIdentity(input: {
  userId: string
  telegramId: string
  providerData: Record<string, unknown>
  displayName: string
  /** Имя-заглушка: только его можно заменить именем из Telegram */
  placeholderName: string
}): Promise<void> {
  const now = new Date()

  await db.transaction(async (tx) => {
    await tx.insert(authIdentities).values({
      id: uuidv7(),
      userId: input.userId,
      provider: 'telegram',
      providerUserId: input.telegramId,
      providerData: input.providerData,
      // Основной способ входа — почта; Telegram подтверждает подписку
      isPrimary: false,
      verifiedAt: now,
    })

    await tx
      .update(users)
      .set({ displayName: input.displayName, updatedAt: now })
      .where(
        and(
          eq(users.id, input.userId),
          eq(users.displayName, input.placeholderName),
          isNull(users.onboardingDoneAt),
        ),
      )
  })
}

/** Уборка: ключи, истёкшие или использованные раньше `before` */
export async function deleteStaleLinkTokens(before: Date): Promise<number> {
  const rows = await db
    .delete(telegramLinkTokens)
    .where(or(lt(telegramLinkTokens.expiresAt, before), lt(telegramLinkTokens.usedAt, before)))
    .returning({ id: telegramLinkTokens.id })

  return rows.length
}
