import { buildCalendarEvent } from '@/modules/streams'
import { getStreamBySlug } from '@/modules/streams/service'
import { RETURN_TO_PARAM } from '@/shared/config/constants'
import { clientEnv } from '@/shared/config/env.client'
import { routes } from '@/shared/routes'

import { getContentViewer } from '../../../../app/_lib/viewer'

/**
 * Анонс эфира файлом для календаря.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ОБРАБОТЧИК АДРЕСА, А НЕ ДЕЙСТВИЕ СЕРВЕРА
 *
 * Скачивание файла — это переход, и обычная ссылка даёт всё сразу:
 * работает без JavaScript, на телефоне сразу открывает календарь,
 * копируется и правильно объявляется экранным диктором. Действие
 * сервера вернуло бы строку в браузер, откуда файл пришлось бы
 * собирать вручную (API.md, «действие или адрес»).
 * ─────────────────────────────────────────────────────────────────
 *
 * Подписка здесь не проверяется намеренно: в файл попадают тема, время
 * и ссылка на страницу — то же самое, что человек уже видит на экране.
 * Требовать за это оплату не за что. А вот войти нужно: эфиры клуба
 * не публичны, и отдавать расписание постороннему незачем.
 *
 * Черновики недоступны по общему правилу — их отсекает сам модуль,
 * когда у смотрящего нет права их видеть.
 */

type Context = { params: Promise<{ slug: string }> }

export async function GET(request: Request, context: Context) {
  const { slug } = await context.params

  // Тот же читатель, что у страниц закрытой зоны: черновик своего эфира
  // куратор в календарь добавить может, посторонний — не может даже
  // узнать, что такой адрес существует
  const viewer = await getContentViewer('streams.view_drafts')

  if (!viewer) {
    return redirectTo(withReturnTo(routes.app.streams.stream(slug), request))
  }

  const stream = await getStreamBySlug(viewer, slug).catch(() => null)

  if (!stream) {
    return new Response('Эфир не найден', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  const url = new URL(routes.app.streams.stream(stream.slug), clientEnv.appUrl).toString()

  const file = buildCalendarEvent({
    // Идентификатор устойчивый: повторное добавление обновит запись
    // в календаре, а не создаст вторую
    uid: `stream-${stream.id}@${new URL(clientEnv.appUrl).host}`,
    title: stream.title,
    description: [stream.description, url].filter(Boolean).join('\n\n'),
    startsAt: stream.startsAt,
    url,
  })

  return new Response(file, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      // Имя файла — адресное имя эфира: в папке загрузок должно быть
      // видно, что это за событие
      'Content-Disposition': `attachment; filename="${stream.slug}.ics"`,
      // Время эфира куратор может перенести. Закэшированный файл
      // выдал бы старое время после переноса
      'Cache-Control': 'no-store',
    },
  })
}

function redirectTo(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: url, 'Cache-Control': 'no-store' },
  })
}

/** Запоминаем, за чем человек приходил, чтобы вернуть его сюда после входа */
function withReturnTo(path: string, request: Request): string {
  const target = new URL(routes.home(), clientEnv.appUrl)
  target.searchParams.set(RETURN_TO_PARAM, new URL(request.url).pathname || path)

  return target.toString()
}
