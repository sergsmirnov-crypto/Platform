import { getSession } from '@/modules/identity/current-user'
import { getViewTicket } from '@/modules/media/service'
import { clientEnv } from '@/shared/config/env.client'
import { ERROR_CODES, toAppError } from '@/shared/errors'
import { getLogger } from '@/shared/logger'
import { routes } from '@/shared/routes'

/**
 * Показ материала в браузере — для табов рядом с видео (шаг 10.6).
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗАЧЕМ ОТДЕЛЬНЫЙ АДРЕС РЯДОМ СО СКАЧИВАНИЕМ
 *
 * Тот же файл, те же проверки прав — но другой заголовок ответа
 * хранилища: «показать» вместо «сохранить». С заголовком «сохранить»
 * браузер молча скачивает PDF и не показывает ничего, а рамка рядом
 * с видео остаётся пустой.
 *
 * И проверки всё-таки не те же: показать можно PDF и картинку,
 * а скачать — ещё и Guitar Pro с минусовкой.
 * ─────────────────────────────────────────────────────────────────
 *
 * **Про срок жизни подписанной ссылки.** Опасение, что она протухнет
 * посреди занятия, не оправдалось: рамка обращается сюда, а не к самому
 * хранилищу, и подпись выдаётся заново при каждой загрузке. Уже
 * открытый PDF живёт в памяти браузера и от истечения подписи
 * не страдает.
 */

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Context) {
  const { id } = await context.params
  const session = await getSession()

  // Без сессии возвращаем отказ, а не перенаправление на вход: ответ
  // читает рамка внутри страницы, и страница входа внутри неё выглядит
  // как поломка
  if (!session) {
    return plain('Нужно войти', 401)
  }

  try {
    const ticket = await getViewTicket(session.user.id, id)

    return new Response(null, {
      status: 302,
      // `no-store` обязателен: подписанная ссылка живёт минуты,
      // а закэшированный ответ пережил бы её
      headers: { Location: ticket.url, 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    const appError = toAppError(error)

    if (appError.code === ERROR_CODES.SUBSCRIPTION_REQUIRED) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: new URL(routes.app.subscriptionExpired(), clientEnv.appUrl).toString(),
          'Cache-Control': 'no-store',
        },
      })
    }

    if (!appError.isExpected) {
      getLogger().error({ err: appError, assetId: id, url: request.url }, 'не удалось показать материал') // prettier-ignore
    }

    return plain(appError.message, appError.httpStatus)
  }
}

function plain(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
