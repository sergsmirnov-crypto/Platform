import { findTelegramIdByUserId, findUserByTelegramId } from '@/modules/identity/repository'
import {
  findReconcileCandidates,
  reconcileAccess,
  syncAccessFromKnownMembership,
  syncToolsySubscriptions,
} from '@/modules/subscription'
import type { ReconcileTarget } from '@/modules/subscription'
import { appConfig } from '@/shared/config'
import { serverEnv } from '@/shared/config/env.server'
import { getLogger } from '@/shared/logger'

/**
 * Ночная сверка подписок с Toolsy и Telegram.
 *
 * Ловит то, что потеряли уведомления: сервер был недоступен, обработка
 * упала, бота на десять минут лишили администратора. Каждый такой случай —
 * человек, у которого состояние разошлось с действительностью и который
 * узнаёт об этом, только когда перестаёт открываться видео.
 *
 * Сначала Toolsy, потом Telegram: сверка чата пересчитывает доступ
 * с учётом обоих источников, и сведения Toolsy к этому моменту должны
 * быть свежими. Источники независимы — недоступность одного не мешает
 * сверить другой (ADR-0031).
 *
 * Сопоставление «участник платформы ↔ идентификатор Telegram» делается
 * здесь, а не внутри модуля подписок: тот ничего не знает о способах
 * входа, иначе два модуля ссылались бы друг на друга по кругу. Задача —
 * верхний слой, ей видны оба.
 */
export async function runSubscriptionReconcile(): Promise<void> {
  await reconcileWithToolsy()
  await reconcileWithTelegram()
}

async function reconcileWithToolsy(): Promise<void> {
  const log = getLogger()
  const report = await syncToolsySubscriptions()

  if (report.unreachable) {
    log.warn({ job: 'subscription.reconcile' }, 'сверить подписки с Toolsy не удалось')
  }

  // Пересчитываем доступ тем, у кого подписка изменилась и кто уже
  // подключил Telegram. Остальным доступ откроется при подключении
  let recalculated = 0

  for (const telegramId of report.changedTelegramIds) {
    const identity = await findUserByTelegramId(telegramId)
    if (!identity) continue

    await syncAccessFromKnownMembership(identity.userId, telegramId)
    recalculated += 1
  }

  if (report.checked > 0 || report.changedTelegramIds.length > 0) {
    log.info(
      {
        job: 'subscription.reconcile',
        source: 'toolsy',
        checked: report.checked,
        changed: report.changedTelegramIds.length,
        recalculated,
      },
      'сверка с Toolsy выполнена',
    )
  }
}

async function reconcileWithTelegram(): Promise<void> {
  const log = getLogger()
  const channelId = serverEnv.TELEGRAM_CHANNEL_ID

  if (!channelId) {
    log.warn({ job: 'subscription.reconcile' }, 'закрытый канал не настроен, сверка чата пропущена')
    return
  }

  const userIds = await findReconcileCandidates({
    staleAfterHours: appConfig.subscription.reconcileStaleHours,
    limit: appConfig.subscription.reconcileBatchSize,
  })

  const targets: ReconcileTarget[] = []

  for (const userId of userIds) {
    const telegramId = await findTelegramIdByUserId(userId)
    if (telegramId) targets.push({ userId, telegramId })
  }

  const report = await reconcileAccess(targets, channelId)

  log.info(
    { job: 'subscription.reconcile', source: 'telegram', ...report, discrepancies: undefined },
    'сверка подписок с Telegram выполнена',
  )

  /*
   * Заметное расхождение означает, что уведомления не доходят, —
   * и это важнее самих расхождений. Один-два случая в месяц нормальны;
   * десять за ночь означают, что вебхук сломан, а платформа об этом
   * молчит уже сутки.
   */
  if (report.discrepancies.length >= appConfig.subscription.reconcileAlertThreshold) {
    log.error(
      { job: 'subscription.reconcile', fixed: report.fixed, checked: report.checked },
      'много расхождений при сверке: проверьте, доходят ли уведомления Telegram',
    )
  }

  if (report.unreachable > 0) {
    log.warn(
      { job: 'subscription.reconcile', unreachable: report.unreachable },
      'часть участников сверить не удалось: Telegram недоступен',
    )
  }
}
