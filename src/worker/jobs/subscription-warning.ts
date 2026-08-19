import { notificationStrings } from '@/modules/notifications'
import { notifyAndDeliver } from '@/modules/notifications/jobs'
import { getExpiringSoon } from '@/modules/subscription'
import { appConfig } from '@/shared/config'
import { getLogger } from '@/shared/logger'
import { routes } from '@/shared/routes'

/**
 * Предупреждение о заканчивающейся подписке.
 *
 * Единственный тип уведомлений, от которого нельзя отказаться: это
 * не новость, а предупреждение о потере оплаченного доступа. Человек,
 * пропустивший его, узнаёт о конце подписки, упёршись в закрытый разбор
 * посреди занятия.
 *
 * Задача идёт раз в сутки, поэтому один человек получает предупреждение
 * несколько дней подряд — по разу в день, пока подписка не продлена
 * или не закончилась. Это намеренно: одно сообщение за три дня легко
 * пропустить.
 */
export async function runSubscriptionWarning(): Promise<void> {
  const days = appConfig.notifications.subscriptionWarningDays
  const expiring = await getExpiringSoon(days)

  for (const item of expiring) {
    await notifyAndDeliver([item.userId], {
      type: 'subscription.expiring',
      title: notificationStrings.events.subscriptionExpiring(item.daysLeft),
      actionUrl: routes.app.me.settings(),
    })
  }

  getLogger().info(
    { job: 'subscription.warning', warned: expiring.length },
    'предупреждения о подписке разосланы',
  )
}
