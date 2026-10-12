import type { ToolsySubscription } from '@/shared/toolsy'

/**
 * Разбор сведений от Toolsy — сервиса, через который оплачивается подписка.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЧИСТЫЕ ФУНКЦИИ: НИ БАЗЫ, НИ СЕТИ
 *
 * Сюда приходит то, что прислал внешний сервис, — форма ответа может
 * поменяться без предупреждения. Каждое поле проверяется явно, а решение
 * «что это значит» отделено от «что с этим сделать», чтобы его можно
 * было проверить тестами.
 *
 * Цена ошибки та же, что и с Telegram: неверно истолкованное событие
 * отбирает доступ у человека, который заплатил.
 * ─────────────────────────────────────────────────────────────────
 */

/** Подписка Toolsy в том виде, в каком её хранит платформа */
export type ToolsyFact = {
  subscriptionId: string
  telegramId: string
  /** Состояние в Toolsy в нижнем регистре: active, delayed, expired, canceled */
  status: string
  expiresAt: Date | null
  productId: string | null
  /** Когда подписку последний раз меняли в Toolsy */
  sourceUpdatedAt: Date | null
}

/**
 * Состояния, в которых подписка даёт доступ.
 *
 * `delayed` — очередное списание не прошло, и Toolsy пробует ещё раз.
 * Доступ в это время сохраняется: человек не отказывался платить,
 * у него, скорее всего, просто кончились деньги на карте до зарплаты.
 * Если повторы не помогут, Toolsy пришлёт «подписка закончилась».
 */
export const TOOLSY_ACCESS_STATUSES = ['active', 'delayed'] as const

/** Даёт ли подписка Toolsy доступ к клубу */
export function isToolsyActive(status: string): boolean {
  return (TOOLSY_ACCESS_STATUSES as readonly string[]).includes(status)
}

/** События, которые меняют подписку. Остальные платформе не нужны */
const SUBSCRIPTION_EVENTS = new Set([
  'subscription.created',
  'subscription.updated',
  'subscription.canceled',
])

function asNonEmptyString(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function asDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

/**
 * Достаёт из объекта подписки то, что нужно платформе.
 *
 * `null` — объект не похож на подписку или в нём нет человека: без
 * идентификатора Telegram сопоставить оплату с участником нечем.
 */
export function readToolsySubscription(raw: unknown): ToolsyFact | null {
  const subscription = asRecord(raw) as ToolsySubscription | null
  if (!subscription) return null

  const subscriptionId = asNonEmptyString(subscription.id)
  const status = asNonEmptyString(subscription.status)?.toLowerCase() ?? null
  const telegramId = asNonEmptyString(subscription.visit?.client?.tgId)

  if (!subscriptionId || !status || !telegramId) return null

  return {
    subscriptionId,
    telegramId,
    status,
    expiresAt: asDate(subscription.expiredAt),
    productId: asNonEmptyString(subscription.latestInvoice?.subscriptionPlan?.product?.id),
    sourceUpdatedAt: asDate(subscription.updatedAt),
  }
}

/**
 * Относится ли подписка к клубу.
 *
 * Через тот же Toolsy может продаваться что-то ещё — отдельный курс,
 * разовая консультация. Если продукт клуба указан в настройках, чужие
 * подписки доступа к платформе не дают. Подписка, у которой продукт
 * неизвестен, принимается: лучше лишний раз открыть доступ, чем закрыть
 * его оплатившему.
 */
export function belongsToClub(
  subscription: { productId: string | null },
  clubProductId: string | null | undefined,
): boolean {
  if (!clubProductId) return true
  if (!subscription.productId) return true
  return subscription.productId === clubProductId
}

/** Что означает пришедшее уведомление */
export type ToolsyVerdict =
  | { kind: 'subscription'; eventId: string | null; eventType: string; fact: ToolsyFact }
  | { kind: 'ignored'; reason: string }

/**
 * Толкует уведомление Toolsy.
 *
 * @param clubProductId продукт клуба из настроек. Пусто — любой
 */
export function interpretToolsyEvent(
  event: unknown,
  clubProductId: string | null | undefined,
): ToolsyVerdict {
  const body = asRecord(event)
  const eventType = asNonEmptyString(body?.type)

  if (!body || !eventType) {
    return { kind: 'ignored', reason: 'не похоже на уведомление Toolsy' }
  }

  if (!SUBSCRIPTION_EVENTS.has(eventType)) {
    // Платежи, возвраты, первый запуск бота: на доступ влияет только
    // итог — состояние подписки, о котором придёт отдельное событие
    return { kind: 'ignored', reason: `событие ${eventType} не меняет подписку` }
  }

  const fact = readToolsySubscription(body.data)

  if (!fact) {
    return { kind: 'ignored', reason: 'в событии нет подписки или Telegram ID человека' }
  }

  if (!belongsToClub(fact, clubProductId)) {
    return { kind: 'ignored', reason: 'подписка на другой продукт' }
  }

  return { kind: 'subscription', eventId: asNonEmptyString(body.id), eventType, fact }
}
