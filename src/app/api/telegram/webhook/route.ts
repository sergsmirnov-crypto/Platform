import { after } from 'next/server'

import { findUserByTelegramId } from '@/modules/identity/repository'
import {
  claimTelegramUpdate,
  interpretUpdate,
  isWebhookSecretValid,
  markTelegramUpdate,
  recordChannelMembership,
} from '@/modules/subscription'
import { serverEnv } from '@/shared/config/env.server'
import { getLogger } from '@/shared/logger'
import type { TelegramUpdate } from '@/shared/telegram/types'

/**
 * Уведомления Telegram об изменении состава закрытого канала.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗДЕСЬ ПОДПИСКА СТАНОВИТСЯ ЖИВОЙ
 *
 * Человек оплачивает через Tribute → Tribute добавляет его в закрытый
 * канал → Telegram присылает сюда событие → доступ открывается. Секунды.
 *
 * Интеграции с Tribute при этом нет и не нужно: источник истины —
 * членство в канале. Если Tribute завтра поменяет API или его заменят
 * другим сервисом, здесь не изменится ничего (PRD v0.2 §4.1).
 * ─────────────────────────────────────────────────────────────────
 *
 * Три правила этого обработчика:
 *
 * 1. **Отвечаем 200 сразу.** Telegram считает доставку неудачной, если
 *    ответа нет, и повторяет её. Обработка идёт после ответа.
 * 2. **Отвечаем 200 даже на ошибку обработки.** Повторная доставка
 *    того же уведомления её не починит, а расхождение подберёт ночная
 *    сверка. Единственное исключение — неверный секрет: это не Telegram.
 * 3. **Каждое уведомление обрабатывается один раз.** Занятие по
 *    `update_id` до ответа; повтор просто не пройдёт дальше.
 *
 * Настройка адреса — один раз командой `pnpm telegram:webhook`.
 */

export async function POST(request: Request): Promise<Response> {
  const log = getLogger()

  // Единственное, что отличает Telegram от того, кто решил подарить себе
  // подписку поддельным уведомлением: адрес открыт для запросов из интернета
  if (
    !isWebhookSecretValid(
      request.headers.get('x-telegram-bot-api-secret-token'),
      serverEnv.TELEGRAM_WEBHOOK_SECRET,
    )
  ) {
    log.warn('уведомление Telegram с неверным секретом отклонено')

    return new Response('forbidden', { status: 403 })
  }

  let update: TelegramUpdate
  try {
    update = (await request.json()) as TelegramUpdate
  } catch {
    return new Response('bad request', { status: 400 })
  }

  if (typeof update?.update_id !== 'number') {
    return new Response('bad request', { status: 400 })
  }

  const updateId = String(update.update_id)

  const isFirstTime = await claimTelegramUpdate(updateId, update as Record<string, unknown>)

  if (!isFirstTime) {
    // Повторная доставка. Telegram повторяет, пока не получит 200,
    // и однажды повторит уже обработанное
    log.info({ updateId }, 'повторное уведомление Telegram пропущено')

    return Response.json({ ok: true, duplicate: true })
  }

  // Обработка после ответа: Telegram не должен ждать наших запросов к базе
  after(() => processUpdate(updateId, update))

  return Response.json({ ok: true })
}

async function processUpdate(updateId: string, update: TelegramUpdate): Promise<void> {
  const log = getLogger()

  try {
    const verdict = interpretUpdate(update, serverEnv.TELEGRAM_CHANNEL_ID)

    if (verdict.kind === 'ignored') {
      await markTelegramUpdate(updateId, 'ignored', verdict.reason)
      return
    }

    if (verdict.kind === 'bot_status') {
      /*
       * Бота лишили администратора — и уведомления о составе канала
       * перестанут приходить. Молча, без единой ошибки: платформа будет
       * работать по последнему известному состоянию и не заметит,
       * что связь оборвалась.
       *
       * Поэтому это единственное место обработчика, которое пишет
       * в журнал уровнем «ошибка»: такое обязано попасть в оповещения.
       */
      if (!verdict.isAdmin) {
        log.error(
          { status: verdict.status },
          'бот потерял права администратора в закрытом канале: подписки перестанут обновляться',
        )
      } else {
        log.info({ status: verdict.status }, 'права бота в канале изменились')
      }

      await markTelegramUpdate(updateId, 'processed')
      return
    }

    /*
     * Человека может не быть на платформе: он оплатил и попал в канал,
     * но ни разу не заходил. Факт всё равно записывается — по
     * идентификатору Telegram, — и при первом входе доступ откроется
     * сам. Иначе он увидел бы «подписки нет», хотя деньги заплачены.
     */
    const identity = await findUserByTelegramId(verdict.telegramId)

    await recordChannelMembership(verdict.telegramId, verdict.isMember, verdict.status, {
      userId: identity?.userId ?? null,
      source: 'webhook',
      at: verdict.occurredAt,
    })

    await markTelegramUpdate(updateId, 'processed')

    log.info(
      { telegramId: verdict.telegramId, isMember: verdict.isMember, known: Boolean(identity) },
      'состав закрытого канала изменился',
    )
  } catch (error) {
    // Ответ Telegram уже отправлен, повторить доставку он не может.
    // Расхождение подберёт ночная сверка — ради этого она и существует
    log.error({ err: error, updateId }, 'не удалось обработать уведомление Telegram')

    await markTelegramUpdate(updateId, 'failed', String(error)).catch(() => undefined)
  }
}
