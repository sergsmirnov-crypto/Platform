import 'server-only'

import { requirePermission } from '@/modules/access'
import { AUDIT_ACTIONS, recordAudit } from '@/modules/audit'
import { avatarUrlFor } from '@/modules/identity'
import { appConfig } from '@/shared/config'

import {
  countByStatus,
  countNeedingAttention,
  findLastVerificationAt,
  findRecentEvents,
  findSubscriptions,
} from './admin-repository'
import { findSubscriptionHistory } from './repository'
import { grantAccessManually, revokeAccessManually } from './service'

import type { SubscriptionFilter, SubscriptionRow } from './admin-repository'
import type { EntitlementStatus } from './entitlement-policy'

/**
 * Обзор подписок для администратора.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЭКРАН ОТВЕЧАЕТ НА ДВА ВОПРОСА
 *
 * «Что с подпиской у этого человека» — повседневный, приходит из чата
 * поддержки. И «работает ли связь с Telegram вообще» — редкий,
 * но такой, который никто не задаёт, пока не станет поздно.
 *
 * Второй вопрос важнее и потому вынесен наверх: если уведомления
 * перестали доходить, платформа продолжает работать по последнему
 * известному состоянию и молчит об этом. Единственное, что выдаёт
 * поломку, — растущее число исправлений ночной сверкой.
 * ─────────────────────────────────────────────────────────────────
 */

export type SubscriptionSummary = {
  active: number
  grace: number
  expired: number
  none: number
  /** Кого давно не удавалось сверить или связь с Telegram оборвана */
  attention: number
  /** Когда последний раз что-либо сверялось: жива ли ночная задача */
  lastVerifiedAt: Date | null
}

export type SubscriptionListItem = {
  userId: string
  displayName: string
  avatarUrl: string | null
  status: EntitlementStatus
  source: SubscriptionRow['source']
  validUntil: Date | null
  graceUntil: Date | null
  lastVerifiedAt: Date | null
  isUnreachable: boolean
}

export type SubscriptionOverview = {
  summary: SubscriptionSummary
  items: SubscriptionListItem[]
  events: {
    id: string
    userId: string
    displayName: string
    eventType: string
    source: string
    reason: string | null
    occurredAt: Date
  }[]
}

const LIST_LIMIT = 100
const EVENTS_LIMIT = 30

export async function getSubscriptionOverview(
  actorId: string,
  filter: SubscriptionFilter = null,
): Promise<SubscriptionOverview> {
  await requirePermission(actorId, 'subs.view')

  const now = new Date()
  const staleBefore = new Date(
    now.getTime() - appConfig.subscription.staleAfterHours * 2 * 60 * 60 * 1000,
  )
  const eventsSince = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [byStatus, attention, lastVerifiedAt, rows, events] = await Promise.all([
    countByStatus(),
    countNeedingAttention(staleBefore),
    findLastVerificationAt(),
    findSubscriptions(filter, { staleBefore, limit: LIST_LIMIT }),
    findRecentEvents(eventsSince, EVENTS_LIMIT),
  ])

  return {
    summary: {
      active: byStatus.get('active') ?? 0,
      grace: byStatus.get('grace') ?? 0,
      expired: byStatus.get('expired') ?? 0,
      none: byStatus.get('none') ?? 0,
      attention,
      lastVerifiedAt,
    },
    items: rows.map(toListItem),
    events: events.map((event) => ({
      id: event.id,
      userId: event.userId,
      displayName: event.displayName,
      eventType: event.eventType,
      source: event.source,
      reason: typeof event.payload.reason === 'string' ? event.payload.reason : null,
      occurredAt: event.occurredAt,
    })),
  }
}

function toListItem(row: SubscriptionRow): SubscriptionListItem {
  return {
    userId: row.userId,
    displayName: row.displayName,
    avatarUrl: avatarUrlFor(row.userId, row.avatarId, 'sm'),
    status: row.status,
    source: row.source,
    validUntil: row.validUntil,
    graceUntil: row.graceUntil,
    lastVerifiedAt: row.lastVerifiedAt,
    isUnreachable: row.verificationState === 'tg_unreachable',
  }
}

/** История событий конкретного человека — для его карточки */
export async function getSubscriptionHistory(actorId: string, userId: string) {
  await requirePermission(actorId, 'subs.view')

  const rows = await findSubscriptionHistory(userId)

  return rows
    .map((row) => ({
      id: String(row.id),
      eventType: row.eventType,
      source: row.source,
      reason: typeof row.payload.reason === 'string' ? row.payload.reason : null,
      occurredAt: row.occurredAt,
    }))
    .reverse()
}

/**
 * Ручная выдача доступа.
 *
 * Нужна ровно в одном случае: автоматика ошиблась, а человек заплатил.
 * Поэтому причина обязательна и пишется в два места — в журнал событий
 * подписки и в журнал действий. Через месяц вопрос «почему у него доступ,
 * хотя он не в канале» должен решаться чтением, а не догадками.
 */
export async function grantAccess(
  actorId: string,
  userId: string,
  options: { reason: string; validUntil: Date | null; ipHash?: string | null },
): Promise<void> {
  await requirePermission(actorId, 'subs.grant')

  await grantAccessManually(userId, {
    reason: options.reason,
    validUntil: options.validUntil,
    actorId,
  })

  await recordAudit({
    actorId,
    action: AUDIT_ACTIONS.subscriptionGrant,
    entityType: 'user',
    entityId: userId,
    diff: { reason: options.reason, validUntil: options.validUntil?.toISOString() ?? null },
    ipHash: options.ipHash ?? null,
  })
}

/** Ручной отзыв доступа */
export async function revokeAccess(
  actorId: string,
  userId: string,
  options: { reason: string; ipHash?: string | null },
): Promise<void> {
  await requirePermission(actorId, 'subs.grant')

  await revokeAccessManually(userId, { reason: options.reason, actorId })

  await recordAudit({
    actorId,
    action: AUDIT_ACTIONS.subscriptionRevoke,
    entityType: 'user',
    entityId: userId,
    diff: { reason: options.reason },
    ipHash: options.ipHash ?? null,
  })
}
