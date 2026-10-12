import { after } from 'next/server'

import { findUserByTelegramId } from '@/modules/identity/repository'
import { interpretToolsyEvent, recordToolsySubscription } from '@/modules/subscription'
import type { ToolsyVerdict } from '@/modules/subscription'
import { serverEnv } from '@/shared/config/env.server'
import { getLogger } from '@/shared/logger'
import { verifyToolsySignature } from '@/shared/toolsy'

/**
 * Уведомления Toolsy — сервиса, через который участники платят за клуб.
 *
 * ─────────────────────────────────────────────────────────────────
 * ВТОРОЙ ПУТЬ ОПЛАТЫ, НЕЗАВИСИМЫЙ ОТ TELEGRAM (ADR-0031)
 *
 * Человек оплачивает в Toolsy → Toolsy сразу сообщает сюда → доступ
 * открывается. Telegram в этой цепочке не участвует: если его
 * заблокируют, оплаты всё равно будут учитываться.
 * ─────────────────────────────────────────────────────────────────
 *
 * Правила те же, что у уведомлений Telegram:
 *
 * 1. **Подлинность — по подписи.** Адрес открыт для всего интернета;
 *    без верной подписи запрос отклоняется, не дойдя до базы.
 * 2. **Отвечаем 200 сразу, обработка — после ответа.** Повторная
 *    доставка ошибку обработки не починит, а расхождение подберёт
 *    ночная сверка с Toolsy.
 * 3. **Повтор безвреден.** Сведения о подписке применяются, только если
 *    они новее сохранённых, поэтому отдельный учёт доставок не нужен.
 *
 * Адрес указывается в кабинете Toolsy: `https://<домен>/api/toolsy/webhook`
 * (docs/OPERATIONS.md).
 */

export async function POST(request: Request): Promise<Response> {
  const log = getLogger()
  const secret = serverEnv.TOOLSY_WEBHOOK_SECRET

  // Toolsy не настроен — адреса для внешнего мира как будто нет
  if (!secret) {
    return new Response('not found', { status: 404 })
  }

  // Подпись считается по телу ровно в том виде, в каком оно пришло
  const rawBody = await request.text()

  if (!verifyToolsySignature(request.headers.get('toolsy-signature'), rawBody, secret)) {
    log.warn('уведомление Toolsy с неверной подписью отклонено')

    return new Response('forbidden', { status: 403 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return new Response('bad request', { status: 400 })
  }

  const verdict = interpretToolsyEvent(body, serverEnv.TOOLSY_PRODUCT_ID)

  if (verdict.kind === 'ignored') {
    log.info({ reason: verdict.reason }, 'уведомление Toolsy пропущено')

    return Response.json({ ok: true })
  }

  after(() => processSubscription(verdict))

  return Response.json({ ok: true })
}

async function processSubscription(
  verdict: Extract<ToolsyVerdict, { kind: 'subscription' }>,
): Promise<void> {
  const log = getLogger()
  const { fact } = verdict

  try {
    /*
     * Человек может ещё не подключить Telegram к аккаунту или вовсе
     * не заходить на платформу. Факт всё равно записывается — по
     * идентификатору Telegram, — и доступ откроется сам, когда подключит.
     */
    const identity = await findUserByTelegramId(fact.telegramId)

    await recordToolsySubscription(fact, {
      userId: identity?.userId ?? null,
      source: 'webhook',
    })

    log.info(
      {
        eventId: verdict.eventId,
        eventType: verdict.eventType,
        status: fact.status,
        known: Boolean(identity),
      },
      'подписка в Toolsy изменилась',
    )
  } catch (error) {
    // Ответ уже отправлен. Расхождение подберёт ночная сверка с Toolsy
    log.error({ err: error, eventId: verdict.eventId }, 'не удалось обработать уведомление Toolsy')
  }
}
