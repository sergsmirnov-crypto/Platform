import 'server-only'

import { appConfig } from '@/shared/config'
import { getLogger } from '@/shared/logger'

import { applyEvent, daysUntilLoss, grantsAccess } from './entitlement-policy'
import {
  findEntitlement,
  findEntitlementsNeedingTimeCheck,
  findExpiringSoon,
  findMembership,
  findUsersWithAccess,
  insertSubscriptionEvent,
  saveEntitlement,
  saveMembership,
} from './repository'

import type { EntitlementEvent, EntitlementState } from './entitlement-policy'

/**
 * Подписки: кто имеет доступ к платному содержимому.
 *
 * Главный принцип (PRD v0.1 §7.1): решение о доступе принимает платформа,
 * а не Telegram. Мессенджер лишь присылает событие «человек вошёл в канал»
 * или «вышел из него»; состояние хранится у нас.
 *
 * Следствие, ради которого это и сделано: при недоступном Telegram платформа
 * продолжает работать. Молчание мессенджера никогда не означает
 * «подписка кончилась».
 */

/** Что человеку доступно прямо сейчас */
export type AccessStatus = {
  /** Открыто ли платное содержимое: видео, табы, уроки */
  hasAccess: boolean
  status: EntitlementState['status']
  source: EntitlementState['source']
  /** Идёт ли льготный период — повод показать баннер «продлите подписку» */
  isInGracePeriod: boolean
  /** Сколько дней осталось. `null` — срок не ограничен */
  daysLeft: number | null
  /** Не удаётся связаться с Telegram: доступ выдан по последнему известному */
  isStale: boolean
}

function toAccessStatus(state: EntitlementState, isStale: boolean, now: Date): AccessStatus {
  return {
    hasAccess: grantsAccess(state.status),
    status: state.status,
    source: state.source,
    isInGracePeriod: state.status === 'grace',
    daysLeft: daysUntilLoss(state, now),
    isStale,
  }
}

/**
 * Состояние доступа участника.
 *
 * Заодно проверяет, не истёк ли срок: без этого человек с закончившимся
 * льготным периодом сохранял бы доступ до ближайшей ночной сверки.
 */
export async function getAccessStatus(userId: string): Promise<AccessStatus> {
  const now = new Date()
  const stored = await findEntitlement(userId)

  const { next, changed } = applyEvent(
    stored,
    { type: 'time_passed' },
    { graceDays: appConfig.subscription.graceDays, now },
  )

  if (changed) {
    await saveEntitlement(userId, next)
    await insertSubscriptionEvent({
      userId,
      eventType: 'expired',
      source: 'reconcile',
      payload: { reason: 'срок истёк' },
    })
    getLogger().info({ userId, status: next.status }, 'состояние доступа обновлено по времени')
  }

  return toAccessStatus(next, stored.verificationState === 'tg_unreachable', now)
}

/** Короткий ответ на вопрос «пускать ли к платному содержимому» */
export async function hasActiveAccess(userId: string): Promise<boolean> {
  return (await getAccessStatus(userId)).hasAccess
}

/**
 * Применяет событие к состоянию доступа участника.
 *
 * Единственная точка изменения: сюда приходят и уведомления Telegram,
 * и ночная сверка, и ручные действия администратора. Благодаря этому
 * запись в журнал невозможно забыть.
 */
export async function applySubscriptionEvent(
  userId: string,
  event: EntitlementEvent,
  source: 'webhook' | 'reconcile' | 'admin' | 'payment',
  payload: Record<string, unknown> = {},
): Promise<AccessStatus> {
  const now = new Date()
  const stored = await findEntitlement(userId)

  const { next, changed } = applyEvent(stored, event, {
    graceDays: appConfig.subscription.graceDays,
    now,
  })

  if (changed) {
    await saveEntitlement(userId, next, { lastVerifiedAt: now, verificationState: 'ok' })
    await insertSubscriptionEvent({
      userId,
      eventType: eventTypeFor(event),
      source,
      payload,
    })

    getLogger().info(
      { userId, from: stored.status, to: next.status, source },
      'состояние доступа изменено',
    )
  }

  return toAccessStatus(next, false, now)
}

function eventTypeFor(event: EntitlementEvent) {
  switch (event.type) {
    case 'joined_channel':
      return 'joined' as const
    case 'left_channel':
      return 'left' as const
    case 'manual_grant':
      return 'manual_grant' as const
    case 'manual_revoke':
      return 'manual_revoke' as const
    case 'time_passed':
      return 'expired' as const
  }
}

/**
 * Записывает факт членства в канале и пересчитывает доступ.
 *
 * Факт сохраняется всегда, даже если человека ещё нет на платформе:
 * ключ таблицы членства — идентификатор Telegram. Доступ пересчитывается
 * только при наличии аккаунта.
 */
export async function recordChannelMembership(
  telegramId: string,
  isMember: boolean,
  lastStatus: string,
  options: { userId?: string | null; source: 'webhook' | 'reconcile'; at?: Date } = {
    source: 'webhook',
  },
): Promise<void> {
  const at = options.at ?? new Date()

  await saveMembership({
    telegramId,
    isMember,
    lastStatus,
    ...(options.source === 'webhook' ? { eventAt: at } : { verifiedAt: at }),
  })

  if (!options.userId) return

  await applySubscriptionEvent(
    options.userId,
    { type: isMember ? 'joined_channel' : 'left_channel' },
    options.source,
    { telegramStatus: lastStatus },
  )
}

/**
 * Восстанавливает доступ по ранее накопленным фактам.
 *
 * Вызывается при каждом входе: человек мог оплатить подписку задолго
 * до того, как впервые открыл платформу. Событие о его входе в канал
 * пришло тогда, когда аккаунта ещё не существовало, — и без этой проверки
 * он увидел бы «подписки нет», хотя деньги заплачены.
 *
 * Идентификатор Telegram приходит аргументом, а не запрашивается у модуля
 * `identity`: иначе модули ссылались бы друг на друга по кругу. Подписки
 * ничего не знают о способах входа — они работают с участником платформы.
 */
export async function syncAccessFromKnownMembership(
  userId: string,
  telegramId: string,
): Promise<AccessStatus> {
  const membership = await findMembership(telegramId)
  if (!membership) return getAccessStatus(userId)

  return applySubscriptionEvent(
    userId,
    { type: membership.isMember ? 'joined_channel' : 'left_channel' },
    'reconcile',
    { reason: 'восстановление по накопленным фактам', telegramStatus: membership.lastStatus },
  )
}

/** Ручная выдача доступа администратором */
export async function grantAccessManually(
  userId: string,
  options: { validUntil?: Date | null; reason: string; actorId: string },
): Promise<AccessStatus> {
  return applySubscriptionEvent(
    userId,
    { type: 'manual_grant', validUntil: options.validUntil ?? null },
    'admin',
    { reason: options.reason, actorId: options.actorId },
  )
}

/** Ручной отзыв доступа администратором */
export async function revokeAccessManually(
  userId: string,
  options: { reason: string; actorId: string },
): Promise<AccessStatus> {
  return applySubscriptionEvent(userId, { type: 'manual_revoke' }, 'admin', {
    reason: options.reason,
    actorId: options.actorId,
  })
}

/**
 * Закрывает доступ тем, у кого истёк срок.
 *
 * Фоновая задача: без неё состояние в базе расходится с действительностью
 * до следующего входа человека, и отчёты по подпискам врут.
 */
export async function expireOutdatedEntitlements(): Promise<number> {
  const now = new Date()
  const candidates = await findEntitlementsNeedingTimeCheck(now)

  let changedCount = 0

  for (const candidate of candidates) {
    const { next, changed } = applyEvent(
      candidate,
      { type: 'time_passed' },
      { graceDays: appConfig.subscription.graceDays, now },
    )

    if (!changed) continue

    await saveEntitlement(candidate.userId, next)
    await insertSubscriptionEvent({
      userId: candidate.userId,
      eventType: 'expired',
      source: 'reconcile',
      payload: { reason: 'срок истёк' },
    })
    changedCount += 1
  }

  return changedCount
}

/**
 * Получатели клубной рассылки: все, у кого сейчас есть доступ.
 *
 * Живёт здесь, а не в модуле уведомлений: кто считается участником —
 * знание подписок. Уведомления получают список и не задают вопросов.
 */
export async function getNotifiableUserIds(): Promise<string[]> {
  return findUsersWithAccess()
}

/**
 * У кого доступ заканчивается в ближайшие дни.
 *
 * @returns идентификатор и сколько дней осталось
 */
export async function getExpiringSoon(
  days: number,
): Promise<{ userId: string; daysLeft: number }[]> {
  const now = new Date()
  const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

  const rows = await findExpiringSoon(now, until)

  return rows.map((row) => ({
    userId: row.userId,
    daysLeft: row.validUntil
      ? Math.max(0, Math.ceil((row.validUntil.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
      : 0,
  }))
}
