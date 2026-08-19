import { findTelegramIdByUserId } from '@/modules/identity/repository'
import { findReconcileCandidates, reconcileAccess } from '@/modules/subscription'
import type { ReconcileTarget } from '@/modules/subscription'
import { appConfig } from '@/shared/config'
import { serverEnv } from '@/shared/config/env.server'
import { getLogger } from '@/shared/logger'

/**
 * Ночная сверка подписок с Telegram.
 *
 * Ловит то, что потеряли уведомления: сервер был недоступен, обработка
 * упала, бота на десять минут лишили администратора. Каждый такой случай —
 * человек, у которого состояние разошлось с действительностью и который
 * узнаёт об этом, только когда перестаёт открываться видео.
 *
 * Сопоставление «участник платформы ↔ идентификатор Telegram» делается
 * здесь, а не внутри модуля подписок: тот ничего не знает о способах
 * входа, иначе два модуля ссылались бы друг на друга по кругу. Задача —
 * верхний слой, ей видны оба.
 */
export async function runSubscriptionReconcile(): Promise<void> {
  const log = getLogger()
  const channelId = serverEnv.TELEGRAM_CHANNEL_ID

  if (!channelId) {
    log.warn({ job: 'subscription.reconcile' }, 'закрытый канал не настроен, сверка пропущена')
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
    { job: 'subscription.reconcile', ...report, discrepancies: undefined },
    'сверка подписок выполнена',
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
