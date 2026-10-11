import 'server-only'

import { AsyncLocalStorage } from 'node:async_hooks'

import { logger } from './logger'

import type { Logger } from './logger'

/**
 * Контекст запроса.
 *
 * У каждого запроса есть свой идентификатор, который автоматически
 * подставляется во все записи журнала. Благодаря этому по одной строке
 * из сообщения об ошибке можно вытащить всю цепочку: что человек открыл,
 * какие запросы к базе ушли, где всё сломалось.
 *
 * Без этого в журнале лежит каша из перемешанных строк от разных
 * одновременных посетителей.
 *
 * AsyncLocalStorage — механизм Node.js: значение доступно всему коду
 * внутри запроса без передачи его через каждый вызов.
 */

export type RequestContext = {
  requestId: string
  /** Кто выполняет запрос. Появится на Этапе 2 вместе с авторизацией */
  userId?: string
  route?: string
}

const storage = new AsyncLocalStorage<RequestContext>()

export function runWithRequestContext<T>(context: RequestContext, callback: () => T): T {
  return storage.run(context, callback)
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore()
}

/**
 * Журнал, знающий о текущем запросе.
 *
 * Используйте его вместо `logger` везде, где код выполняется
 * в рамках обработки запроса.
 */
export function getLogger(): Logger {
  const context = storage.getStore()
  return context ? (logger.child(context) as Logger) : logger
}
