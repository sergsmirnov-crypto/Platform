import 'server-only'

import { and, count, desc, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm'

import { users } from '@/modules/identity/schema'
import { db } from '@/shared/db'

import { entitlements, subscriptionEvents } from './schema'

import type { EntitlementStatus } from './entitlement-policy'
import type { SQL } from 'drizzle-orm'

/**
 * Запросы экрана подписок.
 *
 * Отдельно от `repository.ts` по той же причине, что и у прав: тот
 * отвечает на вопрос «есть ли доступ у этого человека» и вызывается
 * при каждой отрисовке каждой страницы. Здесь — редкие обзорные запросы
 * администратора.
 *
 * Участники без записи о доступе в этих запросах не участвуют: экран
 * отвечает на вопрос «что с подписками», а человек, ни разу не касавшийся
 * подписки, ответа на него не содержит. Он есть в списке участников.
 */

export type SubscriptionRow = {
  userId: string
  displayName: string
  avatarId: string | null
  status: EntitlementStatus
  source: 'telegram_channel' | 'telegram_payment' | 'manual' | 'promo' | 'toolsy' | null
  validUntil: Date | null
  graceUntil: Date | null
  lastVerifiedAt: Date | null
  verificationState: 'ok' | 'stale' | 'tg_unreachable'
}

const columns = {
  userId: entitlements.userId,
  displayName: users.displayName,
  avatarId: users.avatarId,
  status: entitlements.status,
  source: entitlements.source,
  validUntil: entitlements.validUntil,
  graceUntil: entitlements.graceUntil,
  lastVerifiedAt: entitlements.lastVerifiedAt,
  verificationState: entitlements.verificationState,
}

/** Сколько человек в каждом состоянии — верхняя строка экрана */
export async function countByStatus(): Promise<Map<EntitlementStatus, number>> {
  const rows = await db
    .select({ status: entitlements.status, total: count(entitlements.id) })
    .from(entitlements)
    .innerJoin(users, eq(users.id, entitlements.userId))
    .where(isNull(users.deletedAt))
    .groupBy(entitlements.status)

  return new Map(rows.map((row) => [row.status, row.total]))
}

export type SubscriptionFilter = EntitlementStatus | 'attention' | null

/**
 * Список подписок.
 *
 * Отбор «требует внимания» собирает две разные беды в одну: тех, кого
 * давно не удавалось сверить, и тех, у кого связь с Telegram оборвана.
 * Разделять их на экране незачем — действие в обоих случаях одно
 * и то же: посмотреть, работает ли вебхук.
 */
export async function findSubscriptions(
  filter: SubscriptionFilter,
  options: { staleBefore: Date; limit: number },
): Promise<SubscriptionRow[]> {
  return db
    .select(columns)
    .from(entitlements)
    .innerJoin(users, eq(users.id, entitlements.userId))
    .where(and(isNull(users.deletedAt), ...conditions(filter, options.staleBefore)))
    .orderBy(desc(entitlements.updatedAt))
    .limit(options.limit)
}

function conditions(filter: SubscriptionFilter, staleBefore: Date): SQL[] {
  if (!filter) return []

  if (filter === 'attention') {
    return [
      and(
        inArray(entitlements.status, ['active', 'grace']),
        or(
          eq(entitlements.verificationState, 'tg_unreachable'),
          isNull(entitlements.lastVerifiedAt),
          lt(entitlements.lastVerifiedAt, staleBefore),
        ),
      ) as SQL,
    ]
  }

  return [eq(entitlements.status, filter)]
}

/** Сколько записей требуют внимания — для значка рядом с отбором */
export async function countNeedingAttention(staleBefore: Date): Promise<number> {
  const [row] = await db
    .select({ total: count(entitlements.id) })
    .from(entitlements)
    .innerJoin(users, eq(users.id, entitlements.userId))
    .where(and(isNull(users.deletedAt), ...conditions('attention', staleBefore)))

  return row?.total ?? 0
}

export type RecentEvent = {
  id: string
  userId: string
  displayName: string
  eventType: string
  source: string
  payload: Record<string, unknown>
  occurredAt: Date
}

/**
 * Что произошло с подписками за последнее время.
 *
 * Главная ценность — события с источником «сверка»: каждое такое означает,
 * что уведомление от Telegram не дошло и расхождение исправила ночная
 * задача. Одно-два в месяц нормальны; поток означает, что вебхук сломан.
 */
export async function findRecentEvents(since: Date, limit: number): Promise<RecentEvent[]> {
  const rows = await db
    .select({
      id: subscriptionEvents.id,
      userId: subscriptionEvents.userId,
      displayName: users.displayName,
      eventType: subscriptionEvents.eventType,
      source: subscriptionEvents.source,
      payload: subscriptionEvents.payload,
      occurredAt: subscriptionEvents.occurredAt,
    })
    .from(subscriptionEvents)
    .innerJoin(users, eq(users.id, subscriptionEvents.userId))
    .where(and(gte(subscriptionEvents.occurredAt, since), isNull(users.deletedAt)))
    .orderBy(desc(subscriptionEvents.occurredAt))
    .limit(limit)

  // Идентификатор события — bigint, а он не переживает передачу
  // из серверного компонента в браузерный: там его просто нет
  return rows.map((row) => ({ ...row, id: String(row.id) }))
}

/** Когда последний раз что-либо сверялось: показывает, жива ли ночная задача */
export async function findLastVerificationAt(): Promise<Date | null> {
  const [row] = await db
    .select({ at: sql<Date | null>`max(${entitlements.lastVerifiedAt})` })
    .from(entitlements)

  return row?.at ?? null
}
