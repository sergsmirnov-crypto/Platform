import 'server-only'

import { appConfig } from '@/shared/config'
import { serverEnv } from '@/shared/config/env.server'
import { getLogger } from '@/shared/logger'

import { applyEvent, daysUntilLoss, grantsAccess } from './entitlement-policy'
import {
  findEntitlement,
  findEntitlementsNeedingTimeCheck,
  findExpiringSoon,
  findMembership,
  findToolsySubscriptionsByTelegramId,
  findUsersWithAccess,
  insertSubscriptionEvent,
  saveEntitlement,
  saveMembership,
  saveToolsySubscription,
} from './repository'
import { belongsToClub, isToolsyActive } from './toolsy'

import type { EntitlementEvent, EntitlementState, PaidSource } from './entitlement-policy'
import type { ToolsyFact } from './toolsy'

/**
 * Подписки: кто имеет доступ к платному содержимому.
 *
 * Главный принцип (PRD v0.1 §7.1): решение о доступе принимает платформа,
 * а не Telegram. Источники лишь присылают факты; состояние хранится у нас.
 *
 * Источников два (ADR-0031): членство в закрытом чате и подписка в Toolsy —
 * сервисе, через который участник платит. Доступ открыт, если оплату
 * подтверждает хотя бы один. Так сбой одного источника не отнимает доступ:
 * Telegram заблокирован — оплаты по-прежнему приходят от Toolsy; Toolsy
 * молчит — работает членство в чате.
 *
 * Следствие, ради которого это и сделано: при недоступном источнике
 * платформа продолжает работать. Молчание никогда не означает
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
  /** Не удаётся связаться с источником: доступ выдан по последнему известному */
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
 * Единственная точка изменения: сюда приходят уведомления Telegram и Toolsy,
 * ночная сверка и ручные действия администратора. Благодаря этому
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
    case 'paid_confirmed':
      return event.source === 'toolsy' ? ('payment_ok' as const) : ('joined' as const)
    case 'paid_lost':
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
 * Подтверждает ли оплату хоть один источник.
 *
 * Toolsy в приоритете, когда подтверждают оба: это сервис, где человек
 * платит, а чат — лишь его следствие. На доступ выбор не влияет,
 * только на то, что записано в журнале.
 *
 * @returns `known: false` — ни один источник ничего о человеке не сообщал.
 *          Это не «подписки нет», а «нечего пересчитывать»
 */
async function resolvePaidSource(
  telegramId: string,
): Promise<{ source: PaidSource | null; known: boolean }> {
  const [membership, toolsySubscriptions] = await Promise.all([
    findMembership(telegramId),
    findToolsySubscriptionsByTelegramId(telegramId),
  ])

  const clubSubscriptions = toolsySubscriptions.filter((subscription) =>
    belongsToClub(subscription, serverEnv.TOOLSY_PRODUCT_ID),
  )
  const toolsyActive = clubSubscriptions.some((subscription) => isToolsyActive(subscription.status))

  const source: PaidSource | null = toolsyActive
    ? 'toolsy'
    : membership?.isMember
      ? 'telegram_channel'
      : null

  return { source, known: Boolean(membership) || clubSubscriptions.length > 0 }
}

/**
 * Пересчитывает доступ по фактам от обоих источников.
 *
 * Единственное место, где факты превращаются в событие для автомата.
 * Каждый источник сообщает только о себе, и пересчитывать доступ по
 * одному из них нельзя: выход из чата человека, который платит через
 * Toolsy, не должен отнимать у него доступ.
 */
async function recomputePaidAccess(
  userId: string,
  telegramId: string,
  source: 'webhook' | 'reconcile',
  payload: Record<string, unknown>,
): Promise<AccessStatus> {
  const paid = await resolvePaidSource(telegramId)

  if (!paid.known) return getAccessStatus(userId)

  return applySubscriptionEvent(
    userId,
    paid.source ? { type: 'paid_confirmed', source: paid.source } : { type: 'paid_lost' },
    source,
    { ...payload, confirmedBy: paid.source },
  )
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

  await recomputePaidAccess(options.userId, telegramId, options.source, {
    telegramStatus: lastStatus,
  })
}

/**
 * Записывает подписку Toolsy и пересчитывает доступ.
 *
 * Как и членство в канале, факт сохраняется всегда: человек мог оплатить,
 * ещё не подключив Telegram к аккаунту. Доступ откроется сам, когда
 * подключит, — по накопленному факту.
 *
 * @returns изменилось ли состояние подписки по сравнению с известным
 */
export async function recordToolsySubscription(
  fact: ToolsyFact,
  options: { userId?: string | null; source: 'webhook' | 'reconcile' },
): Promise<{ statusChanged: boolean }> {
  const { previousStatus } = await saveToolsySubscription(
    fact,
    options.source === 'reconcile' ? { verifiedAt: new Date() } : {},
  )

  if (options.userId) {
    await recomputePaidAccess(options.userId, fact.telegramId, options.source, {
      provider: 'toolsy',
      toolsyStatus: fact.status,
      toolsySubscriptionId: fact.subscriptionId,
    })
  }

  return { statusChanged: previousStatus !== fact.status }
}

/**
 * Восстанавливает доступ по ранее накопленным фактам.
 *
 * Вызывается при каждом входе и после ночной сверки Toolsy: человек мог
 * оплатить подписку задолго до того, как впервые открыл платформу.
 * Событие об оплате пришло тогда, когда аккаунта ещё не существовало, —
 * и без этой проверки он увидел бы «подписки нет», хотя деньги заплачены.
 *
 * Идентификатор Telegram приходит аргументом, а не запрашивается у модуля
 * `identity`: иначе модули ссылались бы друг на друга по кругу. Подписки
 * ничего не знают о способах входа — они работают с участником платформы.
 */
export async function syncAccessFromKnownMembership(
  userId: string,
  telegramId: string,
): Promise<AccessStatus> {
  return recomputePaidAccess(userId, telegramId, 'reconcile', {
    reason: 'восстановление по накопленным фактам',
  })
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
