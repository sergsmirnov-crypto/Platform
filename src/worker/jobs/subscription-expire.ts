import { expireOutdatedEntitlements } from '@/modules/subscription'
import { getLogger } from '@/shared/logger'

/**
 * Закрытие доступа тем, у кого истёк срок.
 *
 * Состояние в базе меняется по событиям, а время идёт само. Без этой задачи
 * человек с закончившимся льготным периодом числился бы действующим
 * участником до своего следующего входа — и отчёты по подпискам врали бы.
 *
 * Проверка при открытии страницы тоже есть, но она срабатывает только для
 * тех, кто зашёл. Задача покрывает остальных.
 */
export async function runSubscriptionExpiry(): Promise<void> {
  const changed = await expireOutdatedEntitlements()

  getLogger().info({ job: 'subscription.expire', changed }, 'проверка сроков подписки выполнена')
}
