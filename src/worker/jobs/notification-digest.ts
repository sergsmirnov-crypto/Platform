import { deliverDigest, purgeOldFeed } from '@/modules/notifications/jobs'
import { getLogger } from '@/shared/logger'

/**
 * Вечерняя сводка.
 *
 * Всё накопившееся за день уходит одним сообщением на человека. Это
 * и есть исполнение правила «не более одного уведомления в день»
 * (PRD v0.1 §7.5): ограничение соблюдается устройством доставки,
 * а не подсчётом и обрезанием отправленного.
 *
 * Час запуска задан в настройках: клуб занимается вечером, и сообщение
 * приходит тогда, когда человек может сесть за инструмент.
 */
export async function runNotificationDigest(): Promise<void> {
  const { users, delivered } = await deliverDigest()

  getLogger().info({ job: 'notification.digest', users, delivered }, 'вечерняя сводка разослана')
}

/**
 * Уборка ленты уведомлений.
 *
 * Уведомление — указатель на содержимое, а не сам контент: через полгода
 * разбор всё так же лежит в каталоге, а строка «опубликован новый разбор»
 * не нужна никому.
 */
export async function runNotificationCleanup(): Promise<void> {
  const removed = await purgeOldFeed()

  getLogger().info({ job: 'notification.cleanup', removed }, 'уборка ленты уведомлений выполнена')
}
