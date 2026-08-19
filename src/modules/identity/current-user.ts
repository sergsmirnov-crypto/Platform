import 'server-only'

import { cache } from 'react'

import { errors } from '@/shared/errors'

import { readSessionCookie } from './cookie'
import { resolveSession } from './service'

import type { SessionContext } from './types'

/**
 * Текущий человек.
 *
 * Главная точка входа для всего закрытого содержимого: страницы, действия
 * и обработчики адресов начинают с неё.
 *
 * **О кэшировании.** Обёртка `cache` из React запоминает результат
 * в пределах одной отрисовки страницы: даже если текущего человека
 * спросят двадцать компонентов, запрос к базе будет один.
 *
 * Кэша с временем жизни здесь намеренно нет, хотя для прав доступа он есть.
 * Причина в том, ради чего вообще выбраны серверные сессии (ADR-0003):
 * отзыв доступа должен действовать мгновенно. Кэш на тридцать секунд
 * означал бы, что закрытая сессия ещё полминуты работает, — и главное
 * преимущество модели пропало бы. Один индексный запрос к базе того стоит.
 */

export const getSession = cache(async (): Promise<SessionContext | null> => {
  const token = await readSessionCookie()
  return resolveSession(token)
})

/**
 * Текущий человек, обязательно.
 *
 * Бросает ошибку «нужно войти», если сессии нет. Использовать в местах,
 * где отсутствие человека — не нормальная ситуация, а ошибка: серверные
 * действия, обработчики форм.
 *
 * Для страниц лучше подходит `getSession` с явным перенаправлением:
 * человеку нужно показать форму входа, а не сообщение об ошибке.
 */
export async function requireSession(): Promise<SessionContext> {
  const session = await getSession()

  if (!session) {
    throw errors.unauthorized()
  }

  return session
}
