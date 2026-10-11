import { PgBoss } from 'pg-boss'

import type { QueueOptions } from 'pg-boss'

/**
 * Очередь фоновых задач.
 *
 * Задачи хранятся в той же PostgreSQL, что и остальные данные. Это осознанный
 * выбор вместо привычного Redis: минус целый сервис, который надо поднимать,
 * обновлять и чинить. При наших объёмах — сотни задач в сутки — разница
 * в скорости незаметна, а разница в сложности эксплуатации огромна.
 *
 * Побочная выгода: задача и данные, которые она меняет, попадают в одну
 * резервную копию. При восстановлении из бэкапа не возникает ситуации,
 * когда очередь помнит о задачах, которых в базе уже нет.
 */

export const JOB_QUEUES = {
  /** Проверка, что фоновые задачи вообще выполняются */
  HEARTBEAT: 'heartbeat',
  /** Уборка истёкших и закрытых сессий */
  SESSION_CLEANUP: 'sessions.cleanup',
  /** Обработка уведомления от Telegram об изменении состава канала (Этап 2) */
  TELEGRAM_UPDATE: 'telegram.update',
  /** Закрытие доступа тем, у кого истёк срок */
  SUBSCRIPTION_EXPIRE: 'subscription.expire',
  /** Ночная сверка подписок с Telegram (шаг 2.5) */
  SUBSCRIPTION_RECONCILE: 'subscription.reconcile',
  /** Уборка оборванных загрузок файлов */
  MEDIA_CLEANUP: 'media.cleanup',
  /** Уборка записей журнала старше срока хранения (шаг 9.6) */
  AUDIT_CLEANUP: 'audit.cleanup',
  /**
   * Вечерняя сводка уведомлений (шаг 10.3).
   *
   * Очереди «отправить одно уведомление» нет намеренно: срочные создают
   * сами фоновые задачи и сразу отправляют, а всё остальное ждёт сводки.
   */
  NOTIFICATION_DIGEST: 'notification.digest',
  /** Уборка ленты уведомлений старше срока хранения (шаг 10.3) */
  NOTIFICATION_CLEANUP: 'notification.cleanup',
  /** Напоминание об эфире за сутки (шаг 10.3) */
  STREAM_REMINDER: 'stream.reminder',
  /** Предупреждение о заканчивающейся подписке (шаг 10.3) */
  SUBSCRIPTION_WARNING: 'subscription.warning',
} as const

export type JobQueue = (typeof JOB_QUEUES)[keyof typeof JOB_QUEUES]

/**
 * Настройки по умолчанию для очередей.
 *
 * Задаются для каждой очереди отдельно: у разных задач разумные значения
 * разные. Повтор уведомления безобиден, повтор списания — нет.
 */
export const DEFAULT_QUEUE_OPTIONS: QueueOptions = {
  /** Три попытки с нарастающей паузой: сбои внешних сервисов обычно кратковременны */
  retryLimit: 3,
  retryDelay: 30,
  retryBackoff: true,
  /** Задача, зависшая дольше пяти минут, считается неудачной и повторяется */
  expireInSeconds: 300,
  /** Выполненные задачи хранятся неделю: хватает, чтобы разобраться в сбое */
  retentionSeconds: 7 * 24 * 60 * 60,
  deleteAfterSeconds: 30 * 24 * 60 * 60,
}

export function createQueue(connectionString: string): PgBoss {
  return new PgBoss({
    connectionString,
    // Свои таблицы очередь держит в отдельной схеме, чтобы не смешиваться
    // с таблицами приложения
    schema: 'pgboss',
    // Отдельному процессу задач много соединений не нужно
    max: 2,
  })
}
