import { notificationStrings } from '@/modules/notifications'
import { notifyAndDeliver } from '@/modules/notifications/jobs'
import { getStreamsStartingBetween } from '@/modules/streams/service'
import { getNotifiableUserIds } from '@/modules/subscription'
import { appConfig } from '@/shared/config'
import { getLogger } from '@/shared/logger'
import { routes } from '@/shared/routes'

/**
 * Напоминание об эфире за сутки.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ОКНО, А НЕ «БЛИЖАЙШИЕ СУТКИ»
 *
 * Задача запускается каждый час. Выборка «всё, что начнётся в ближайшие
 * 24 часа» вернула бы один и тот же эфир двадцать четыре раза подряд,
 * и человек получил бы двадцать четыре напоминания.
 *
 * Поэтому берётся окно шириной в один запуск: эфиры, начинающиеся
 * между «через 24 часа» и «через 25 часов». Каждый эфир попадает в него
 * ровно один раз.
 *
 * Цена: пропущенный запуск (перезагрузка сервера, сбой) означает
 * пропущенное напоминание. Это приемлемо — напоминание не критично,
 * а попытки его «догнать» превращаются в рассылку об эфире, который
 * уже идёт.
 * ─────────────────────────────────────────────────────────────────
 */
export async function runStreamReminder(): Promise<void> {
  const hours = appConfig.notifications.streamReminderHours
  const now = Date.now()

  const from = new Date(now + hours * 60 * 60 * 1000)
  const until = new Date(now + (hours + 1) * 60 * 60 * 1000)

  const streams = await getStreamsStartingBetween(from, until)
  if (streams.length === 0) return

  const recipients = await getNotifiableUserIds()

  for (const stream of streams) {
    const { created } = await notifyAndDeliver(recipients, {
      type: 'stream.reminder',
      title: notificationStrings.events.streamReminder(stream.title),
      actionUrl: routes.app.streams.stream(stream.slug),
    })

    getLogger().info(
      { job: 'stream.reminder', streamId: stream.id, created },
      'напоминание об эфире разослано',
    )
  }
}
