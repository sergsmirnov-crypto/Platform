import 'server-only'

import { serverEnv } from '@/shared/config/env.server'
import { ERROR_CODES, isAppError } from '@/shared/errors'
import { getLogger } from '@/shared/logger'
import { telegram } from '@/shared/telegram/client'
import { isInChannel } from '@/shared/telegram/membership'
import { isToolsyConfigured, toolsy } from '@/shared/toolsy/client'

import {
  findEntitlementsToVerify,
  findMembership,
  findToolsySubscriptionsWithStatus,
  touchVerification,
} from './repository'
import {
  getAccessStatus,
  recordChannelMembership,
  recordToolsySubscription,
  syncAccessFromKnownMembership,
} from './service'
import { belongsToClub, readToolsySubscription, TOOLSY_ACCESS_STATUSES } from './toolsy'

import type { AccessStatus } from './service'

/**
 * Ночная сверка подписок с Telegram и Toolsy.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗАЧЕМ ОНА, ЕСЛИ ЕСТЬ УВЕДОМЛЕНИЯ
 *
 * Уведомления теряются. Сервер был недоступен, обработка упала, бота
 * на десять минут лишили администратора, Telegram не смог достучаться.
 * Каждый такой случай — человек, у которого состояние на платформе
 * разошлось с действительностью, и который об этом узнаёт, только
 * когда у него перестаёт открываться видео.
 *
 * Сверка ловит расхождения раз в сутки. При двухстах пятидесяти
 * участниках это около десяти секунд работы: проверяются только те,
 * у кого доступ есть или недавно был.
 * ─────────────────────────────────────────────────────────────────
 *
 * Недоступность Telegram сверку не ломает: состояние остаётся прежним,
 * помечается как непроверенное, доступ не отбирается. Молчание
 * мессенджера никогда не означает «подписка кончилась» (PRD v0.1 §7.4).
 */

/** Кого сверяем: участник платформы и его идентификатор в Telegram */
export type ReconcileTarget = { userId: string; telegramId: string }

export type ReconcileReport = {
  checked: number
  /** У скольких состояние разошлось с Telegram и было исправлено */
  fixed: number
  /** Скольких проверить не удалось: Telegram недоступен */
  unreachable: number
  /** Скольких пропустили: нет идентификатора Telegram */
  skipped: number
  /** Что именно разошлось — попадает в отчёт администратору */
  discrepancies: { userId: string; wasMember: boolean; nowMember: boolean }[]
}

/** Кого стоит проверить: только действующие и льготные, давно не сверявшиеся */
export async function findReconcileCandidates(options: {
  staleAfterHours: number
  limit: number
  now?: Date
}): Promise<string[]> {
  const now = options.now ?? new Date()
  const before = new Date(now.getTime() - options.staleAfterHours * 60 * 60 * 1000)

  const rows = await findEntitlementsToVerify(before, options.limit)

  return rows.map((row) => row.userId)
}

/**
 * Сверяет состояние с Telegram и приводит платформу в соответствие.
 *
 * Идентификаторы Telegram приходят аргументом, а не запрашиваются
 * у модуля `identity`: подписки ничего не знают о способах входа, иначе
 * два модуля начали бы ссылаться друг на друга по кругу. Сопоставление
 * делает тот, кто вызывает, — фоновая задача.
 */
export async function reconcileAccess(
  targets: readonly ReconcileTarget[],
  channelId: string,
): Promise<ReconcileReport> {
  const log = getLogger()
  const report: ReconcileReport = {
    checked: 0,
    fixed: 0,
    unreachable: 0,
    skipped: 0,
    discrepancies: [],
  }

  for (const target of targets) {
    const telegramUserId = Number(target.telegramId)

    if (!Number.isSafeInteger(telegramUserId)) {
      report.skipped += 1
      continue
    }

    try {
      const member = await telegram.getChatMember(channelId, telegramUserId)
      const nowMember = isInChannel(member)
      const known = await findMembership(target.telegramId)

      report.checked += 1

      // Записываем результат всегда, даже когда ничего не изменилось:
      // иначе тот же человек будет попадать в сверку каждую ночь
      await recordChannelMembership(target.telegramId, nowMember, member?.status ?? 'left', {
        userId: target.userId,
        source: 'reconcile',
      })

      // Расхождение — это когда уведомление о составе чата потерялось.
      // Человек, который платит через Toolsy и в чат не заходил, —
      // не расхождение: он и не должен был в нём числиться
      if ((known?.isMember ?? false) !== nowMember) {
        report.fixed += 1
        report.discrepancies.push({
          userId: target.userId,
          wasMember: known?.isMember ?? false,
          nowMember,
        })
      }
    } catch (error) {
      // Telegram недоступен — состояние остаётся прежним. Доступ
      // не отбирается: это и есть политика fail-open
      if (isAppError(error) && error.code === ERROR_CODES.UPSTREAM_UNAVAILABLE) {
        report.unreachable += 1
        await touchVerification(target.userId, 'tg_unreachable', new Date())
        continue
      }

      log.warn({ err: error, userId: target.userId }, 'не удалось сверить участника')
      report.unreachable += 1
    }
  }

  return report
}

// ─── Toolsy ───

export type ToolsySyncReport = {
  /** Сколько подписок получено от Toolsy */
  checked: number
  /** Люди, у которых состояние подписки в Toolsy изменилось: им пересчитать доступ */
  changedTelegramIds: string[]
  /** Toolsy недоступен: сверка не состоялась, состояние прежнее */
  unreachable: boolean
}

/**
 * Сверяет подписки с Toolsy.
 *
 * Ловит потерянные уведомления в обе стороны:
 *
 * 1. Берёт у Toolsy все действующие подписки клуба. Так находится
 *    оплативший, о котором уведомление не дошло.
 * 2. Подписки, которые у нас числятся действующими, но в этом списке
 *    не оказались, спрашивает у Toolsy по одной. Так находится отменивший.
 *
 * Возвращает тех, у кого что-то изменилось, а не пересчитывает доступ
 * сам: сопоставить идентификатор Telegram с участником платформы может
 * только модуль `identity`, и это делает вызывающий — фоновая задача.
 *
 * Недоступность Toolsy сверку не ломает: состояние остаётся прежним,
 * доступ не отбирается.
 */
export async function syncToolsySubscriptions(): Promise<ToolsySyncReport> {
  const report: ToolsySyncReport = { checked: 0, changedTelegramIds: [], unreachable: false }
  if (!isToolsyConfigured()) return report

  const clubProductId = serverEnv.TOOLSY_PRODUCT_ID
  const changed = new Set<string>()
  const seen = new Set<string>()

  try {
    for (const status of TOOLSY_ACCESS_STATUSES) {
      const subscriptions = await toolsy.listSubscriptions({
        status,
        ...(clubProductId ? { productId: clubProductId } : {}),
      })

      for (const raw of subscriptions) {
        const fact = readToolsySubscription(raw)
        if (!fact || !belongsToClub(fact, clubProductId)) continue

        seen.add(fact.subscriptionId)
        report.checked += 1

        const { statusChanged } = await recordToolsySubscription(fact, { source: 'reconcile' })
        if (statusChanged) changed.add(fact.telegramId)
      }
    }

    // Числятся у нас действующими, но Toolsy их таковыми уже не называет
    const knownActive = await findToolsySubscriptionsWithStatus(TOOLSY_ACCESS_STATUSES)

    for (const stored of knownActive) {
      if (seen.has(stored.id)) continue

      const raw = await toolsy.getSubscription(stored.id)
      const fact = raw ? readToolsySubscription(raw) : null

      // Toolsy подписку не знает — для нас это «подписки нет»
      const current = fact ?? {
        subscriptionId: stored.id,
        telegramId: stored.telegramId,
        status: 'missing',
        expiresAt: null,
        productId: stored.productId,
        sourceUpdatedAt: null,
      }

      report.checked += 1
      const { statusChanged } = await recordToolsySubscription(current, { source: 'reconcile' })
      if (statusChanged) changed.add(current.telegramId)
    }
  } catch (error) {
    report.unreachable = true

    // Сетевой сбой ожидаем и уже записан клиентом. Неверный ключ и прочие
    // отказы — поломка настройки: уровнем «ошибка», чтобы попасть в оповещения.
    // Доступ в обоих случаях никому не меняется
    if (!(isAppError(error) && error.code === ERROR_CODES.UPSTREAM_UNAVAILABLE)) {
      getLogger().error({ err: error }, 'сверка с Toolsy не удалась')
    }
  }

  report.changedTelegramIds = [...changed]
  return report
}

/**
 * Обновляет сведения о подписках одного человека в Toolsy.
 *
 * Только сохраняет факты, доступ не пересчитывает: это сделает тот,
 * кто вызвал, вместе с проверкой чата. Недоступность Toolsy — не ошибка.
 */
async function refreshToolsyFor(telegramId: string): Promise<void> {
  if (!isToolsyConfigured()) return

  const clubProductId = serverEnv.TOOLSY_PRODUCT_ID

  try {
    const subscriptions = await toolsy.listSubscriptions({
      clientTgId: telegramId,
      ...(clubProductId ? { productId: clubProductId } : {}),
    })

    for (const raw of subscriptions) {
      const fact = readToolsySubscription(raw)
      if (fact && belongsToClub(fact, clubProductId)) {
        await recordToolsySubscription(fact, { source: 'reconcile' })
      }
    }
  } catch (error) {
    getLogger().warn(
      { err: error },
      'не удалось проверить подписку в Toolsy, доступ — по накопленным фактам',
    )
  }
}

/**
 * Проверяет оплату прямо сейчас, не дожидаясь ночной сверки.
 *
 * Вызывается в момент подключения Telegram. Человек нажал «Старт» в боте
 * и через секунду вернулся на сайт — он ждёт открытого доступа, а не
 * «подписка подтвердится завтра утром».
 *
 * Спрашивает оба источника: Toolsy — оплатил ли он, Telegram — состоит
 * ли он в чате. Накопленные факты могли устареть или отсутствовать вовсе:
 * например, человек оплатил ещё до того, как бота назначили
 * администратором. Если источник недоступен, доступ вычисляется
 * по накопленным фактам: политика fail-open работает и здесь.
 *
 * @param channelId закрытый канал. Пусто — канал не настроен, его не проверяем
 */
export async function verifyMembershipNow(
  userId: string,
  telegramId: string,
  channelId: string | null | undefined,
): Promise<AccessStatus> {
  await refreshToolsyFor(telegramId)

  const telegramUserId = Number(telegramId)

  if (channelId && Number.isSafeInteger(telegramUserId)) {
    try {
      const member = await telegram.getChatMember(channelId, telegramUserId)

      await recordChannelMembership(telegramId, isInChannel(member), member?.status ?? 'left', {
        userId,
        source: 'reconcile',
      })

      return getAccessStatus(userId)
    } catch (error) {
      getLogger().warn(
        { err: error, userId },
        'не удалось проверить членство при подключении Telegram, доступ — по накопленным фактам',
      )
    }
  }

  return syncAccessFromKnownMembership(userId, telegramId)
}
