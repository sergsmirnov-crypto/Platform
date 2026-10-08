import 'server-only'

import { ERROR_CODES, isAppError } from '@/shared/errors'
import { getLogger } from '@/shared/logger'
import { telegram } from '@/shared/telegram/client'
import { isInChannel } from '@/shared/telegram/membership'

import { findEntitlementsToVerify, touchVerification } from './repository'
import { getAccessStatus, recordChannelMembership, syncAccessFromKnownMembership } from './service'

import type { AccessStatus } from './service'

/**
 * Ночная сверка подписок с Telegram.
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

      report.checked += 1

      // Записываем результат всегда, даже когда ничего не изменилось:
      // иначе тот же человек будет попадать в сверку каждую ночь
      await recordChannelMembership(target.telegramId, nowMember, member?.status ?? 'left', {
        userId: target.userId,
        source: 'reconcile',
      })

      if (!nowMember) {
        report.fixed += 1
        report.discrepancies.push({
          userId: target.userId,
          wasMember: true,
          nowMember: false,
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

/**
 * Проверяет членство в канале прямо сейчас, не дожидаясь ночной сверки.
 *
 * Вызывается в момент подключения Telegram. Человек нажал «Старт» в боте
 * и через секунду вернулся на сайт — он ждёт открытого доступа, а не
 * «подписка подтвердится завтра утром».
 *
 * Сначала спрашиваем Telegram: накопленный факт о членстве мог устареть
 * или отсутствовать вовсе — например, человек оплатил ещё до того, как
 * бота назначили администратором канала. Если Telegram недоступен,
 * доступ вычисляется по накопленным фактам: политика fail-open
 * работает и здесь.
 *
 * @param channelId закрытый канал. Пусто — канал не настроен, проверять нечего
 */
export async function verifyMembershipNow(
  userId: string,
  telegramId: string,
  channelId: string | null | undefined,
): Promise<AccessStatus> {
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
