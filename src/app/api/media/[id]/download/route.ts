import { getSession } from '@/modules/identity/current-user'
import { getDownloadTicket } from '@/modules/media/service'
import { RETURN_TO_PARAM } from '@/shared/config/constants'
import { clientEnv } from '@/shared/config/env.client'
import { ERROR_CODES, toAppError } from '@/shared/errors'
import { getLogger } from '@/shared/logger'
import { routes } from '@/shared/routes'

/**
 * Скачивание материала разбора.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ОБРАБОТЧИК АДРЕСА, А НЕ ДЕЙСТВИЕ СЕРВЕРА
 *
 * Скачивание файла — это переход по ссылке, а не изменение данных.
 * Обычная ссылка даёт всё сразу и бесплатно: работает без JavaScript,
 * открывается в новой вкладке, копируется, ведёт себя как ссылка
 * для чтения с экрана. Действие сервера потребовало бы кода в браузере
 * ради того, что браузер умеет сам (API.md, «действие или адрес»).
 *
 * Файл через наш сервер НЕ проходит: мы проверяем права и отвечаем
 * перенаправлением на подписанный адрес хранилища. Поэтому небольшого
 * сервера хватает при любом объёме скачиваний (ARCHITECTURE §2).
 * ─────────────────────────────────────────────────────────────────
 *
 * Ошибки не показываются страницей ошибки, а возвращают человека туда,
 * где он может что-то сделать: не вошёл — на вход, кончилась подписка —
 * на страницу продления. Сообщение «403 Forbidden» в ответ на нажатие
 * «Скачать табы» не объясняет ничего и никуда не ведёт.
 */

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Context) {
  const { id } = await context.params
  const session = await getSession()

  if (!session) {
    return redirectTo(withReturnTo(routes.home(), request))
  }

  try {
    const ticket = await getDownloadTicket(session.user.id, id)

    return redirectTo(ticket.url)
  } catch (error) {
    const appError = toAppError(error)

    if (appError.code === ERROR_CODES.SUBSCRIPTION_REQUIRED) {
      return redirectTo(absolute(routes.app.subscriptionExpired()))
    }

    if (!appError.isExpected) {
      getLogger().error({ err: appError, assetId: id }, 'не удалось выдать материал')
    }

    return new Response(appError.message, {
      status: appError.httpStatus,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }
}

/**
 * Перенаправление без кэширования.
 *
 * `no-store` обязателен: подписанная ссылка живёт минуты, а закэшированный
 * браузером или посредником ответ пережил бы её и привёл участника
 * к ошибке хранилища вместо файла.
 */
function redirectTo(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: url, 'Cache-Control': 'no-store' },
  })
}

function absolute(path: string): string {
  return new URL(path, clientEnv.appUrl).toString()
}

/** Запоминаем, за чем человек приходил, чтобы вернуть его сюда после входа */
function withReturnTo(path: string, request: Request): string {
  const target = new URL(path, clientEnv.appUrl)
  target.searchParams.set(RETURN_TO_PARAM, new URL(request.url).pathname)

  return target.toString()
}
