import 'server-only'

import { cookies, headers } from 'next/headers'

import { SESSION_COOKIE_NAME } from '@/shared/config/constants'
import { serverEnv } from '@/shared/config/env.server'

import type { RequestOrigin } from './types'

/**
 * Cookie сессии и сведения о запросе.
 *
 * Отделено от логики сессий намеренно: `service.ts` ничего не знает
 * ни о Next.js, ни о cookie — он работает с ключом как со строкой.
 * Благодаря этому сессии можно будет открывать откуда угодно, например
 * из будущего мобильного приложения, где cookie не будет вовсе.
 */

const isProduction = serverEnv.NODE_ENV === 'production'

/**
 * Настройки cookie.
 *
 * `httpOnly` — cookie не видна коду в браузере, поэтому её нельзя украсть
 * скриптом с чужого сайта.
 * `sameSite: 'lax'` — cookie не уходит при запросах с других сайтов,
 * что закрывает подделку запросов. При этом переход по обычной ссылке
 * извне работает — иначе ссылка из Telegram открывала бы страницу входа.
 * `secure` и путь `/` — требования префикса `__Host-` в имени cookie.
 */
function cookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    path: '/',
    expires: expiresAt,
  }
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE_NAME, token, cookieOptions(expiresAt))
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE_NAME, '', { ...cookieOptions(new Date(0)), maxAge: 0 })
}

export async function readSessionCookie(): Promise<string | undefined> {
  const store = await cookies()
  return store.get(SESSION_COOKIE_NAME)?.value
}

/**
 * Откуда пришёл запрос.
 *
 * Адрес берётся из заголовков обратного прокси. Порядок важен:
 * `x-forwarded-for` может содержать цепочку адресов, из которой нужен
 * первый — он ближе всего к настоящему клиенту.
 *
 * Заголовкам нельзя доверять как доказательству: их подделывает кто угодно.
 * Мы используем адрес только для списка устройств и ограничения частоты
 * попыток входа, а не для принятия решений о доступе.
 */
export async function getRequestOrigin(): Promise<RequestOrigin> {
  const store = await headers()

  const forwarded = store.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || store.get('x-real-ip') || null

  return {
    userAgent: store.get('user-agent'),
    ip,
  }
}
