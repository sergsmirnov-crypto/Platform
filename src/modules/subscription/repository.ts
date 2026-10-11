import 'server-only'

import { and, eq, gte, inArray, isNull, lt, or } from 'drizzle-orm'

import { db } from '@/shared/db'

import { channelMemberships, entitlements, subscriptionEvents, telegramUpdates } from './schema'

import type { EntitlementState } from './entitlement-policy'

/**
 * Запросы к базе, связанные с подписками.
 *
 * Единственное место в модуле, где есть SQL.
 */

const EMPTY_STATE: EntitlementState = {
  status: 'none',
  source: null,
  validUntil: null,
  graceUntil: null,
}

export type StoredEntitlement = EntitlementState & {
  lastVerifiedAt: Date | null
  verificationState: 'ok' | 'stale' | 'tg_unreachable'
}

/**
 * Состояние доступа участника.
 *
 * Для человека без записи возвращается пустое состояние, а не `null`:
 * «доступа нет» и «мы про него ничего не знаем» — с точки зрения проверки
 * одно и то же, и заставлять каждое место обрабатывать оба случая незачем.
 */
export async function findEntitlement(userId: string): Promise<StoredEntitlement> {
  const rows = await db
    .select({
      status: entitlements.status,
      source: entitlements.source,
      validUntil: entitlements.validUntil,
      graceUntil: entitlements.graceUntil,
      lastVerifiedAt: entitlements.lastVerifiedAt,
      verificationState: entitlements.verificationState,
    })
    .from(entitlements)
    .where(eq(entitlements.userId, userId))
    .limit(1)

  const row = rows[0]
  if (!row) return { ...EMPTY_STATE, lastVerifiedAt: null, verificationState: 'ok' }

  return row
}

/** Записывает новое состояние доступа. Создаёт запись, если её не было */
export async function saveEntitlement(
  userId: string,
  next: EntitlementState,
  verification: {
    lastVerifiedAt?: Date
    verificationState?: 'ok' | 'stale' | 'tg_unreachable'
  } = {},
): Promise<void> {
  const values = {
    status: next.status,
    source: next.source,
    validUntil: next.validUntil,
    graceUntil: next.graceUntil,
    ...(verification.lastVerifiedAt ? { lastVerifiedAt: verification.lastVerifiedAt } : {}),
    ...(verification.verificationState
      ? { verificationState: verification.verificationState }
      : {}),
    updatedAt: new Date(),
  }

  await db
    .insert(entitlements)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: entitlements.userId, set: values })
}

export type SubscriptionEventInput = {
  userId: string
  eventType:
    | 'joined'
    | 'left'
    | 'kicked'
    | 'payment_ok'
    | 'payment_failed'
    | 'manual_grant'
    | 'manual_revoke'
    | 'expired'
    | 'renewed'
  source: 'webhook' | 'reconcile' | 'admin' | 'payment'
  payload?: Record<string, unknown>
}

/**
 * Дописывает событие в журнал.
 *
 * Журнал только пополняется и никогда не правится: по нему восстанавливается
 * история и разбираются спорные случаи вида «мне не продлили».
 */
export async function insertSubscriptionEvent(input: SubscriptionEventInput): Promise<void> {
  await db.insert(subscriptionEvents).values({
    userId: input.userId,
    eventType: input.eventType,
    source: input.source,
    payload: input.payload ?? {},
  })
}

/** История событий участника — для экрана подписок */
export async function findSubscriptionHistory(userId: string, limit = 50) {
  return db
    .select({
      id: subscriptionEvents.id,
      eventType: subscriptionEvents.eventType,
      source: subscriptionEvents.source,
      payload: subscriptionEvents.payload,
      occurredAt: subscriptionEvents.occurredAt,
    })
    .from(subscriptionEvents)
    .where(eq(subscriptionEvents.userId, userId))
    .orderBy(subscriptionEvents.occurredAt)
    .limit(limit)
}

// ─── Членство в канале ───

export type StoredMembership = {
  telegramId: string
  isMember: boolean
  lastStatus: string | null
  lastEventAt: Date | null
  lastVerifiedAt: Date | null
}

export async function findMembership(telegramId: string): Promise<StoredMembership | null> {
  const rows = await db
    .select({
      telegramId: channelMemberships.telegramId,
      isMember: channelMemberships.isMember,
      lastStatus: channelMemberships.lastStatus,
      lastEventAt: channelMemberships.lastEventAt,
      lastVerifiedAt: channelMemberships.lastVerifiedAt,
    })
    .from(channelMemberships)
    .where(eq(channelMemberships.telegramId, telegramId))
    .limit(1)

  return rows[0] ?? null
}

export type SaveMembershipInput = {
  telegramId: string
  isMember: boolean
  lastStatus: string
  /** Момент события от Telegram */
  eventAt?: Date
  /** Момент прямой сверки с Telegram */
  verifiedAt?: Date
}

/**
 * Сохраняет факт членства.
 *
 * Работает независимо от того, есть ли у человека аккаунт на платформе:
 * ключ здесь — идентификатор Telegram. Событие об оплате не теряется,
 * даже если человек ещё ни разу не заходил.
 */
export async function saveMembership(input: SaveMembershipInput): Promise<void> {
  const values = {
    isMember: input.isMember,
    lastStatus: input.lastStatus,
    ...(input.eventAt ? { lastEventAt: input.eventAt } : {}),
    ...(input.verifiedAt ? { lastVerifiedAt: input.verifiedAt } : {}),
    updatedAt: new Date(),
  }

  await db
    .insert(channelMemberships)
    .values({ telegramId: input.telegramId, ...values })
    .onConflictDoUpdate({ target: channelMemberships.telegramId, set: values })
}

/** Участники, чьё состояние доступа пора перепроверить по времени */
export async function findEntitlementsNeedingTimeCheck(now: Date) {
  return db
    .select({
      userId: entitlements.userId,
      status: entitlements.status,
      source: entitlements.source,
      validUntil: entitlements.validUntil,
      graceUntil: entitlements.graceUntil,
    })
    .from(entitlements)
    .where(or(lt(entitlements.graceUntil, now), lt(entitlements.validUntil, now)))
}

/**
 * Все, у кого сейчас есть доступ.
 *
 * Получатели клубной рассылки: новый разбор, запись эфира. Льготный
 * период включаем — человек ещё в клубе, и новость о разборе может
 * оказаться поводом продлить подписку.
 */
export async function findUsersWithAccess(): Promise<string[]> {
  const rows = await db
    .select({ userId: entitlements.userId })
    .from(entitlements)
    .where(inArray(entitlements.status, ['active', 'grace']))

  return rows.map((row) => row.userId)
}

/**
 * У кого доступ заканчивается в ближайшие дни.
 *
 * Только `active`: тем, кто уже в льготном периоде, платформа показывает
 * баннер при каждом входе, и напоминать им ещё и в мессенджере — перебор.
 */
export async function findExpiringSoon(
  from: Date,
  until: Date,
): Promise<{ userId: string; validUntil: Date | null }[]> {
  return db
    .select({ userId: entitlements.userId, validUntil: entitlements.validUntil })
    .from(entitlements)
    .where(
      and(
        eq(entitlements.status, 'active'),
        gte(entitlements.validUntil, from),
        lt(entitlements.validUntil, until),
      ),
    )
}

/** Состояние доступа сразу для нескольких участников — для экрана подписок */
export async function findEntitlementsByUserIds(userIds: readonly string[]) {
  if (userIds.length === 0) return []

  return db
    .select({
      userId: entitlements.userId,
      status: entitlements.status,
      source: entitlements.source,
      validUntil: entitlements.validUntil,
      graceUntil: entitlements.graceUntil,
    })
    .from(entitlements)
    .where(inArray(entitlements.userId, [...userIds]))
}

/**
 * Занимает уведомление Telegram под обработку.
 *
 * Возвращает `true`, если это уведомление видим впервые. Telegram
 * повторяет доставку, пока не получит ответ 200, и без этой проверки
 * повторная доставка обработалась бы второй раз: в журнале появились бы
 * два одинаковых события, а при неудачном стечении — лишняя запись
 * о выходе из канала.
 *
 * Занятие и обработка разделены намеренно: сначала мы фиксируем сам факт
 * получения, отвечаем Telegram, и только потом разбираемся. Обратный
 * порядок означает повторную доставку каждый раз, когда обработка
 * оказалась медленнее, чем ждёт Telegram.
 */
export async function claimTelegramUpdate(
  updateId: string,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const inserted = await db
    .insert(telegramUpdates)
    .values({ updateId, payload, status: 'received' })
    .onConflictDoNothing()
    .returning({ updateId: telegramUpdates.updateId })

  return inserted.length > 0
}

/** Отмечает, чем закончилась обработка уведомления */
export async function markTelegramUpdate(
  updateId: string,
  status: 'processed' | 'ignored' | 'failed',
  error?: string | null,
): Promise<void> {
  await db
    .update(telegramUpdates)
    .set({ status, error: error ?? null, processedAt: new Date() })
    .where(eq(telegramUpdates.updateId, updateId))
}

/** Убирает старые уведомления: таблица нужна для защиты от повторов, а не как архив */
export async function deleteOldTelegramUpdates(before: Date): Promise<number> {
  const deleted = await db
    .delete(telegramUpdates)
    .where(lt(telegramUpdates.createdAt, before))
    .returning({ updateId: telegramUpdates.updateId })

  return deleted.length
}

/**
 * Кого стоит сверить с Telegram.
 *
 * Только те, у кого доступ есть или недавно был: проверять двести
 * человек с пометкой «подписки нет» бессмысленно — если они вернутся,
 * придёт уведомление.
 *
 * Порог по времени отсекает тех, кого только что проверили по событию.
 */
export async function findEntitlementsToVerify(
  verifiedBefore: Date,
  limit: number,
): Promise<{ userId: string; status: 'none' | 'active' | 'grace' | 'expired' }[]> {
  return db
    .select({ userId: entitlements.userId, status: entitlements.status })
    .from(entitlements)
    .where(
      and(
        inArray(entitlements.status, ['active', 'grace']),
        or(isNull(entitlements.lastVerifiedAt), lt(entitlements.lastVerifiedAt, verifiedBefore)),
      ),
    )
    .limit(limit)
}

/** Отмечает, что сверка состоялась, — даже если ничего не изменилось */
export async function touchVerification(
  userId: string,
  state: 'ok' | 'tg_unreachable',
  at: Date,
): Promise<void> {
  await db
    .update(entitlements)
    .set({ lastVerifiedAt: at, verificationState: state })
    .where(eq(entitlements.userId, userId))
}
