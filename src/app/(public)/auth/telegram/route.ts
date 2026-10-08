import { redirect } from 'next/navigation'

import { getRequestOrigin, setSessionCookie } from '@/modules/identity/cookie'
import { safeReturnTo } from '@/modules/identity/return-to'
import { signInWithTelegram } from '@/modules/identity/telegram-login'
import { RETURN_TO_PARAM } from '@/shared/config/constants'
import { serverEnv } from '@/shared/config/env.server'
import { ERROR_CODES, isAppError } from '@/shared/errors'
import { getLogger } from '@/shared/logger'
import { routes } from '@/shared/routes'
import { checkRateLimit } from '@/shared/security/rate-limit'
import { verifyLoginWidget } from '@/shared/telegram'

import type { NextRequest } from 'next/server'

/**
 * Возврат из виджета входа Telegram.
 *
 * ⚠️ Работает только при TELEGRAM_LOGIN_ENABLED=true (ADR-0030).
 *
 * Виджет настроен на перенаправление: после подтверждения Telegram сам
 * открывает этот адрес и передаёт данные человека параметрами. Обработчик
 * проверяет подпись, открывает сессию и уводит человека внутрь платформы.
 *
 * Почему обработчик адреса, а не страница с формой: сюда приходит обычный
 * переход по ссылке, а не отправка формы. Здесь нечего показывать —
 * нужно поставить cookie и перенаправить.
 *
 * Порядок проверок важен: сначала ограничение частоты, потом подпись.
 * Так перебор упирается в лимит, не нагружая проверку подписи и базу.
 */

/** Причины отказа, которые показываются человеку на странице входа */
const LOGIN_ERROR = {
  RATE_LIMITED: 'too_many',
  INVALID: 'invalid',
  EXPIRED: 'expired',
  UNAVAILABLE: 'unavailable',
  /** Участник заблокирован: подпись верна, но пускать его нельзя */
  BLOCKED: 'blocked',
} as const

function failWith(reason: string): never {
  redirect(`${routes.home()}?error=${reason}`)
}

export async function GET(request: NextRequest): Promise<never> {
  const log = getLogger()
  const params = request.nextUrl.searchParams

  /*
   * Вход через виджет выключен по умолчанию (ADR-0030). Закрыт и сам адрес,
   * а не только кнопка: иначе по прямой ссылке продолжали бы создаваться
   * аккаунты без почты — в них потом не войти обычным способом
   */
  if (serverEnv.TELEGRAM_LOGIN_ENABLED !== 'true') {
    failWith(LOGIN_ERROR.UNAVAILABLE)
  }

  const botToken = serverEnv.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    log.error('вход через Telegram невозможен: не задан TELEGRAM_BOT_TOKEN')
    failWith(LOGIN_ERROR.UNAVAILABLE)
  }

  const origin = await getRequestOrigin()

  const allowed = checkRateLimit({
    action: 'login',
    subject: origin.ip ?? 'unknown',
    limit: 10,
    windowSeconds: 300,
  }).allowed

  if (!allowed) {
    log.warn('превышено число попыток входа')
    failWith(LOGIN_ERROR.RATE_LIMITED)
  }

  const fields: Record<string, string> = {}
  for (const [key, value] of params.entries()) {
    if (key !== RETURN_TO_PARAM) fields[key] = value
  }

  const verified = verifyLoginWidget(fields, botToken)

  if (!verified.ok) {
    // Причину подделки наружу не сообщаем: она полезна только тому,
    // кто подбирает подпись. Истёкшие данные — отдельный случай,
    // там человеку надо просто нажать «войти» ещё раз
    log.warn({ reason: verified.reason }, 'вход через Telegram отклонён')
    failWith(verified.reason === 'expired' ? LOGIN_ERROR.EXPIRED : LOGIN_ERROR.INVALID)
  }

  /*
   * Отказ из-за блокировки — единственная ожидаемая ошибка на этом шаге.
   *
   * Ловим её здесь, а не внутри: перенаправление в Next.js работает
   * через исключение, поэтому оно вынесено за пределы `try` — иначе
   * собственный редирект был бы пойман как ошибка входа.
   */
  let signedIn: Awaited<ReturnType<typeof signInWithTelegram>>

  try {
    signedIn = await signInWithTelegram(verified.data, origin)
  } catch (error) {
    if (isAppError(error) && error.code === ERROR_CODES.FORBIDDEN) {
      failWith(LOGIN_ERROR.BLOCKED)
    }

    throw error
  }

  const { token, expiresAt, isNewUser } = signedIn
  await setSessionCookie(token, expiresAt)

  // Новичка ведём знакомиться, остальных — туда, куда они шли
  const destination = isNewUser
    ? routes.app.onboarding()
    : safeReturnTo(params.get(RETURN_TO_PARAM))

  redirect(destination)
}
