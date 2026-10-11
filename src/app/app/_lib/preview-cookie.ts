import 'server-only'

import { cookies } from 'next/headers'

import { serverEnv } from '@/shared/config/env.server'

import { PREVIEW_COOKIE_NAME, PREVIEW_COOKIE_VALUE } from './preview'

/**
 * Cookie режима «смотреть как участник».
 *
 * Отделено от правил в `preview.ts` намеренно: там чистые функции, которые
 * можно протестировать, здесь — работа с контекстом запроса, которую нельзя.
 *
 * Cookie сеансовая: срок жизни не задан, поэтому браузер удаляет её при
 * закрытии. Это осознанно — режим просмотра временная линза, а не настройка.
 * Закрыл браузер, вернулся завтра — снова куратор, а не участник, который
 * полдня удивляется, куда делись его кнопки.
 */

const isProduction = serverEnv.NODE_ENV === 'production'

/**
 * `httpOnly` — cookie не видна коду страницы: нам она нужна только
 * на сервере. `secure` и путь `/` — требования префикса `__Host-` в имени.
 */
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/',
}

export async function readPreviewCookie(): Promise<string | undefined> {
  const store = await cookies()
  return store.get(PREVIEW_COOKIE_NAME)?.value
}

export async function setPreviewCookie(): Promise<void> {
  const store = await cookies()
  store.set(PREVIEW_COOKIE_NAME, PREVIEW_COOKIE_VALUE, COOKIE_OPTIONS)
}

export async function clearPreviewCookie(): Promise<void> {
  const store = await cookies()
  store.set(PREVIEW_COOKIE_NAME, '', { ...COOKIE_OPTIONS, maxAge: 0 })
}
