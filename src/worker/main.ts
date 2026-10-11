/**
 * Логика процесса фоновых задач.
 *
 * Отделена от `index.ts` намеренно: там переменные окружения загружаются
 * из файла, и сделать это нужно ДО того, как загрузится любой модуль,
 * который их читает. Импорты в JavaScript выполняются раньше кода,
 * поэтому «загрузить настройки, а потом импортировать» в одном файле
 * не работает — нужен отдельный файл-загрузчик.
 */
import { logger } from '@/shared/logger'

import { runAuditCleanup } from './jobs/audit-cleanup'
import { runHeartbeat } from './jobs/heartbeat'
import { runMediaCleanup } from './jobs/media-cleanup'
import { runNotificationCleanup, runNotificationDigest } from './jobs/notification-digest'
import { runSessionCleanup } from './jobs/session-cleanup'
import { runStreamReminder } from './jobs/stream-reminder'
import { runSubscriptionExpiry } from './jobs/subscription-expire'
import { runSubscriptionReconcile } from './jobs/subscription-reconcile'
import { runSubscriptionWarning } from './jobs/subscription-warning'
import { createQueue, DEFAULT_QUEUE_OPTIONS, JOB_QUEUES } from './queue'
import { SCHEDULES } from './schedules'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  logger.error('Не задано подключение к базе данных (DATABASE_URL). Фоновые задачи не запущены.')
  process.exit(1)
}

const boss = createQueue(connectionString)

boss.on('error', (error: unknown) => {
  logger.error({ err: error }, 'сбой очереди задач')
})

async function main(): Promise<void> {
  await boss.start()

  // Очередь нужно объявить до того, как на неё подписываться
  await boss.createQueue(JOB_QUEUES.HEARTBEAT, DEFAULT_QUEUE_OPTIONS)
  await boss.work(JOB_QUEUES.HEARTBEAT, async () => {
    runHeartbeat()
  })

  await boss.createQueue(JOB_QUEUES.SESSION_CLEANUP, DEFAULT_QUEUE_OPTIONS)
  await boss.work(JOB_QUEUES.SESSION_CLEANUP, async () => {
    await runSessionCleanup()
  })

  await boss.createQueue(JOB_QUEUES.MEDIA_CLEANUP, DEFAULT_QUEUE_OPTIONS)
  await boss.work(JOB_QUEUES.MEDIA_CLEANUP, async () => {
    await runMediaCleanup()
  })

  await boss.createQueue(JOB_QUEUES.AUDIT_CLEANUP, DEFAULT_QUEUE_OPTIONS)
  await boss.work(JOB_QUEUES.AUDIT_CLEANUP, async () => {
    await runAuditCleanup()
  })

  await boss.createQueue(JOB_QUEUES.SUBSCRIPTION_EXPIRE, DEFAULT_QUEUE_OPTIONS)
  await boss.work(JOB_QUEUES.SUBSCRIPTION_EXPIRE, async () => {
    await runSubscriptionExpiry()
  })

  await boss.createQueue(JOB_QUEUES.SUBSCRIPTION_RECONCILE, DEFAULT_QUEUE_OPTIONS)
  await boss.work(JOB_QUEUES.SUBSCRIPTION_RECONCILE, async () => {
    await runSubscriptionReconcile()
  })

  await boss.createQueue(JOB_QUEUES.NOTIFICATION_DIGEST, DEFAULT_QUEUE_OPTIONS)
  await boss.work(JOB_QUEUES.NOTIFICATION_DIGEST, async () => {
    await runNotificationDigest()
  })

  await boss.createQueue(JOB_QUEUES.NOTIFICATION_CLEANUP, DEFAULT_QUEUE_OPTIONS)
  await boss.work(JOB_QUEUES.NOTIFICATION_CLEANUP, async () => {
    await runNotificationCleanup()
  })

  await boss.createQueue(JOB_QUEUES.STREAM_REMINDER, DEFAULT_QUEUE_OPTIONS)
  await boss.work(JOB_QUEUES.STREAM_REMINDER, async () => {
    await runStreamReminder()
  })

  await boss.createQueue(JOB_QUEUES.SUBSCRIPTION_WARNING, DEFAULT_QUEUE_OPTIONS)
  await boss.work(JOB_QUEUES.SUBSCRIPTION_WARNING, async () => {
    await runSubscriptionWarning()
  })

  for (const schedule of SCHEDULES) {
    await boss.schedule(schedule.queue, schedule.cron)
    logger.info({ queue: schedule.queue, cron: schedule.cron }, schedule.description)
  }

  logger.info('фоновые задачи запущены')
}

/**
 * Корректное завершение.
 *
 * При остановке контейнера процессу даётся несколько секунд, чтобы доделать
 * текущую задачу. Без этого задача обрывается на середине и повторяется
 * с начала — а если она успела что-то записать, повтор может задвоить данные.
 */
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'останавливаю фоновые задачи')
  try {
    await boss.stop({ graceful: true, timeout: 10_000 })
  } catch (error) {
    logger.error({ err: error }, 'не удалось остановиться корректно')
  }
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))

main().catch((error: unknown) => {
  logger.error({ err: error }, 'фоновые задачи не запустились')
  process.exit(1)
})
