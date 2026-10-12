/**
 * Данные, которые присылает и возвращает Toolsy.
 *
 * Описаны только поля, которыми пользуется платформа, — не весь ответ.
 * Всё помечено необязательным: это данные из внешнего сервиса, и форма
 * ответа может поменяться без предупреждения. Разбор проверяет наличие
 * каждого поля сам, а не доверяет типам.
 *
 * Документация: https://docs.toolsy.bot
 */

/** Состояние подписки в Toolsy */
export type ToolsySubscriptionStatus =
  /** Оплачена и действует */
  | 'active'
  /** Очередное списание не прошло, Toolsy пробует ещё раз */
  | 'delayed'
  /** Срок вышел, продления не было */
  | 'expired'
  /** Отменена */
  | 'canceled'

/** Подписка — то, что получает клиент после оплаты счёта */
export type ToolsySubscription = {
  id?: string
  status?: string
  startedAt?: string | null
  expiredAt?: string | null
  isInfinite?: boolean
  updatedAt?: string
  /** Посещение бота: через него подписка связана с человеком и проектом */
  visit?: {
    client?: {
      /** Идентификатор человека в Telegram. Строкой */
      tgId?: string | null
    } | null
    project?: { id?: string } | null
  } | null
  /** Последний счёт: через него подписка связана с продуктом */
  latestInvoice?: {
    subscriptionPlan?: {
      product?: { id?: string } | null
    } | null
  } | null
}

/** Типы событий, о которых Toolsy умеет сообщать */
export type ToolsyEventType =
  | 'subscription.created'
  | 'subscription.updated'
  | 'subscription.canceled'
  | 'payment.created'
  | 'refund.created'
  | 'visit.created'
  | 'billing-plan.created'
  | 'billing-plan.updated'
  | 'billing-plan.canceled'

/** Тело уведомления: `data` — объект целиком, вызвавший событие */
export type ToolsyEvent = {
  id?: string
  type?: string
  data?: unknown
}

/** Ответ на запрос списка: одна страница */
export type ToolsyPage<T> = {
  pagination?: {
    total?: number
    currentPage?: number
    lastPage?: number
    pageSize?: number
  }
  data?: T[]
}
