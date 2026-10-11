import { appConfig } from '@/shared/config'

import { JOB_QUEUES } from './queue'

/**
 * Задачи по расписанию.
 *
 * Время указано в формате cron. Все расписания собраны здесь, а не разбросаны
 * по коду: иначе через полгода никто не сможет ответить на вопрос
 * «что и когда у нас запускается».
 */
export type Schedule = {
  queue: string
  /** Формат: минута час день месяц день_недели */
  cron: string
  description: string
}

export const SCHEDULES: Schedule[] = [
  {
    queue: JOB_QUEUES.HEARTBEAT,
    cron: '*/5 * * * *',
    description: 'Каждые 5 минут — отметка, что фоновые задачи живы',
  },
  {
    queue: JOB_QUEUES.SESSION_CLEANUP,
    cron: '30 3 * * *',
    description: 'Каждую ночь в 3:30 — уборка истёкших сессий, кодов входа и ключей Telegram',
  },
  {
    queue: JOB_QUEUES.SUBSCRIPTION_EXPIRE,
    cron: '0 3 * * *',
    description: 'Каждую ночь в 3:00 — закрытие доступа с истёкшим сроком',
  },
  {
    queue: JOB_QUEUES.MEDIA_CLEANUP,
    cron: '15 3 * * *',
    description: 'Каждую ночь в 3:15 — уборка оборванных загрузок файлов',
  },
  {
    queue: JOB_QUEUES.AUDIT_CLEANUP,
    cron: '45 3 * * *',
    description: 'Каждую ночь в 3:45 — уборка записей журнала старше года',
  },
  {
    queue: JOB_QUEUES.SUBSCRIPTION_RECONCILE,
    cron: '0 4 * * *',
    description: 'Каждую ночь в 4:00 — сверка подписок с Telegram',
  },
  {
    queue: JOB_QUEUES.NOTIFICATION_CLEANUP,
    cron: '50 3 * * *',
    description: 'Каждую ночь в 3:50 — уборка ленты уведомлений старше полугода',
  },
  {
    queue: JOB_QUEUES.SUBSCRIPTION_WARNING,
    cron: '0 11 * * *',
    description: 'Каждый день в 11:00 — предупреждения о заканчивающейся подписке',
  },
  {
    /*
     * Каждый час, а не раз в сутки. Задача берёт эфиры, начинающиеся
     * в окне «через 24–25 часов»: так каждый эфир попадает в выборку
     * ровно один раз независимо от того, на какое время он назначен.
     * Раз в сутки напоминание пришло бы то за 24 часа, то за 40.
     */
    queue: JOB_QUEUES.STREAM_REMINDER,
    cron: '5 * * * *',
    description: 'Каждый час — напоминания об эфирах, до которых остались сутки',
  },
  {
    queue: JOB_QUEUES.NOTIFICATION_DIGEST,
    cron: `0 ${appConfig.notifications.digestHour} * * *`,
    description: 'Каждый вечер — сводка новостей клуба одним сообщением',
  },
]
