import 'server-only'

import { serverEnv } from '@/shared/config/env.server'
import { errors } from '@/shared/errors'
import { logger } from '@/shared/logger'

import type { ToolsyPage, ToolsySubscription, ToolsySubscriptionStatus } from './types'

/**
 * Клиент Toolsy API — сервиса, через который участники оплачивают подписку.
 *
 * Единственное место в проекте, которое обращается к Toolsy по сети.
 *
 * Как и с Telegram, **недоступность Toolsy — ожидаемая ситуация, а не
 * поломка.** Сетевой сбой, таймаут и ошибка на их стороне превращаются
 * в «внешний сервис недоступен»: вызывающий код продолжает работу
 * по последнему известному состоянию (fail-open, ADR-0031).
 *
 * Отказ из-за неверного ключа — другое дело: это ошибка настройки,
 * и она должна быть заметна, а не тонуть среди сетевых сбоев.
 */

/** Сколько ждём ответа. Дольше держать сверку или страницу незачем */
const REQUEST_TIMEOUT_MS = 10_000

/** Максимальный размер страницы, который принимает Toolsy */
const MAX_PAGE_SIZE = 45

/**
 * Предохранитель от бесконечного перебора страниц.
 *
 * 45 × 50 = 2250 подписок — на порядок больше, чем нужно клубу. Если
 * однажды упрёмся, это повод пересмотреть сверку, а не молча крутить
 * запросы всю ночь
 */
const MAX_PAGES = 50

/** Настроен ли Toolsy: без ключа API обращаться некуда */
export function isToolsyConfigured(): boolean {
  return Boolean(serverEnv.TOOLSY_API_KEY)
}

/** Toolsy доступен и ответил отказом: неверный ключ, неверный запрос */
export class ToolsyApiError extends Error {
  constructor(
    readonly path: string,
    readonly status: number,
  ) {
    super(`Toolsy ${path}: ${status}`)
    this.name = 'ToolsyApiError'
  }
}

async function request<T>(path: string, query: Record<string, string | number> = {}): Promise<T> {
  const apiKey = serverEnv.TOOLSY_API_KEY
  if (!apiKey) {
    throw errors.upstream('toolsy', new Error('TOOLSY_API_KEY не задан'))
  }

  const url = new URL(`${serverEnv.TOOLSY_API_BASE_URL}${path}`)
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, String(value))
  }

  let response: Response
  try {
    response = await fetch(url, {
      headers: { 'x-api-key': apiKey, accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch (cause) {
    logger.warn({ path, err: cause }, 'Toolsy недоступен')
    throw errors.upstream('toolsy', cause)
  }

  // Перегрузка и сбои на их стороне — состояние подписки неизвестно
  if (response.status === 429 || response.status >= 500) {
    logger.warn({ path, status: response.status }, 'Toolsy временно не отвечает')
    throw errors.upstream('toolsy', new Error(`HTTP ${response.status}`))
  }

  if (!response.ok) {
    throw new ToolsyApiError(path, response.status)
  }

  try {
    return (await response.json()) as T
  } catch (cause) {
    logger.warn({ path }, 'Toolsy вернул неразбираемый ответ')
    throw errors.upstream('toolsy', cause)
  }
}

export type SubscriptionFilter = {
  /** Только подписки этого человека */
  clientTgId?: string
  /** Только в этом состоянии */
  status?: ToolsySubscriptionStatus
  /** Только по этому продукту */
  productId?: string
}

/**
 * Все подписки, подходящие под условия, — со всех страниц.
 *
 * Параметры передаются по одному значению: Toolsy принимает в них
 * списки, но способ записи списка в адресе в документации не описан,
 * а одиночное значение понимается при любом способе.
 */
export async function listSubscriptions(
  filter: SubscriptionFilter = {},
): Promise<ToolsySubscription[]> {
  const query: Record<string, string | number> = { pageSize: MAX_PAGE_SIZE }
  if (filter.clientTgId) query.clientTgId = filter.clientTgId
  if (filter.status) query.status = filter.status
  if (filter.productId) query.productId = filter.productId

  const result: ToolsySubscription[] = []

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const body = await request<ToolsyPage<ToolsySubscription>>('/v1/subscriptions', {
      ...query,
      page,
    })

    result.push(...(body.data ?? []))

    const lastPage = body.pagination?.lastPage ?? page
    if (page >= lastPage || (body.data ?? []).length === 0) return result
  }

  logger.warn({ pages: MAX_PAGES }, 'Toolsy: подписок больше предела перебора, список неполный')
  return result
}

/**
 * Одна подписка по идентификатору.
 *
 * `null` — Toolsy такой подписки не знает: для нашей логики это
 * равносильно «подписки нет».
 */
export async function getSubscription(id: string): Promise<ToolsySubscription | null> {
  try {
    return await request<ToolsySubscription>(`/v1/subscriptions/${encodeURIComponent(id)}`)
  } catch (error) {
    if (error instanceof ToolsyApiError && error.status === 404) return null
    throw error
  }
}

export const toolsy = { listSubscriptions, getSubscription }
