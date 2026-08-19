import 'server-only'

import { serverEnv } from '@/shared/config/env.server'
import { errors } from '@/shared/errors'
import { logger } from '@/shared/logger'

import { REQUIRED_UPDATE_TYPES } from './types'

import type { TelegramApiResponse, TelegramChatMember, TelegramUser } from './types'

/**
 * Клиент Telegram Bot API.
 *
 * Единственное место в проекте, которое обращается к Telegram по сети.
 * Всё остальное работает с этим клиентом, а не с адресами и параметрами
 * запросов напрямую.
 *
 * Главная особенность: **недоступность Telegram — ожидаемая ситуация,
 * а не поломка.** Мессенджер могут заблокировать, у него бывают сбои,
 * запрос может просто не уложиться в таймаут. Поэтому сетевые проблемы
 * превращаются в ошибку типа «внешний сервис недоступен», которую
 * вызывающий код обязан обработать и продолжить работу по последнему
 * известному состоянию (политика fail-open, PRD v0.1 §7.4).
 */

const API_BASE = 'https://api.telegram.org'

/**
 * Сколько ждём ответа. Telegram обычно отвечает за десятки миллисекунд;
 * десяти секунд достаточно с большим запасом, а дольше держать
 * страницу открытой нельзя — человек этого ждать не будет.
 */
const REQUEST_TIMEOUT_MS = 10_000

/** Максимальная пауза, которую готовы выдержать при ограничении частоты */
const MAX_RETRY_AFTER_SECONDS = 5

/** Настроен ли Telegram: без токена бота обращаться некуда */
export function isTelegramConfigured(): boolean {
  return Boolean(serverEnv.TELEGRAM_BOT_TOKEN)
}

function requireBotToken(): string {
  const token = serverEnv.TELEGRAM_BOT_TOKEN
  if (!token) {
    throw errors.upstream('telegram', new Error('TELEGRAM_BOT_TOKEN не задан'))
  }
  return token
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Ошибка, с которой Telegram ответил осмысленно.
 *
 * Отличается от сетевого сбоя: сервис доступен, но действие невозможно —
 * например, человека нет в канале или бота лишили прав администратора.
 * Такие случаи разбираются вызывающим кодом по коду ответа.
 */
export class TelegramApiError extends Error {
  constructor(
    readonly method: string,
    readonly errorCode: number,
    readonly description: string,
  ) {
    super(`Telegram ${method}: ${errorCode} ${description}`)
    this.name = 'TelegramApiError'
  }

  /** Человека не существует, он не в канале, или бот его не видит */
  get isNotFound(): boolean {
    return this.errorCode === 400 && /not found|PARTICIPANT_ID_INVALID/i.test(this.description)
  }

  /** Бот потерял права администратора или его выгнали из канала */
  get isForbidden(): boolean {
    return this.errorCode === 403
  }
}

type CallOptions = { retryOnRateLimit?: boolean }

/**
 * Выполняет вызов метода Bot API.
 *
 * Все ошибки делятся на два вида, и это деление принципиально:
 * `TelegramApiError` — Telegram доступен и ответил отказом;
 * `upstream_unavailable` — Telegram недоступен, состояние неизвестно.
 * Только во втором случае включается fail-open.
 */
async function call<T>(
  method: string,
  params: Record<string, unknown> = {},
  options: CallOptions = {},
): Promise<T> {
  const token = requireBotToken()
  const url = `${API_BASE}/bot${token}/${method}`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch (cause) {
    // Сеть, таймаут, блокировка — состояние подписки остаётся неизвестным
    logger.warn({ method, err: cause }, 'Telegram недоступен')
    throw errors.upstream('telegram', cause)
  }

  let body: TelegramApiResponse<T>
  try {
    body = (await response.json()) as TelegramApiResponse<T>
  } catch (cause) {
    logger.warn({ method, status: response.status }, 'Telegram вернул неразбираемый ответ')
    throw errors.upstream('telegram', cause)
  }

  if (body.ok) {
    return body.result
  }

  // Слишком часто обращаемся: Telegram сам говорит, сколько подождать
  const retryAfter = body.parameters?.retry_after
  if (
    body.error_code === 429 &&
    retryAfter !== undefined &&
    retryAfter <= MAX_RETRY_AFTER_SECONDS &&
    options.retryOnRateLimit !== false
  ) {
    logger.info({ method, retryAfter }, 'Telegram просит подождать, повторяем запрос')
    await sleep(retryAfter * 1000)
    return call<T>(method, params, { retryOnRateLimit: false })
  }

  // 5xx означает проблему на стороне Telegram, а не наш неверный запрос
  if (body.error_code >= 500) {
    logger.warn({ method, errorCode: body.error_code }, 'Telegram сообщил о внутренней ошибке')
    throw errors.upstream('telegram', new Error(body.description))
  }

  throw new TelegramApiError(method, body.error_code, body.description)
}

/** Сведения о самом боте. Используется для проверки настроек при запуске */
export function getMe(): Promise<TelegramUser> {
  return call<TelegramUser>('getMe')
}

/**
 * Текущее состояние человека в канале.
 *
 * Возвращает `null`, если Telegram не знает такого участника: для нашей
 * логики это равносильно «в канале его нет». Отдельный случай, потому что
 * Telegram отвечает на это ошибкой, а не пустым результатом.
 *
 * Используется ночной сверкой (PRD v0.2 §4.2): 250 участников проверяются
 * примерно за десять секунд.
 */
export async function getChatMember(
  chatId: string,
  telegramUserId: number,
): Promise<TelegramChatMember | null> {
  try {
    return await call<TelegramChatMember>('getChatMember', {
      chat_id: chatId,
      user_id: telegramUserId,
    })
  } catch (error) {
    if (error instanceof TelegramApiError && error.isNotFound) {
      return null
    }
    throw error
  }
}

/** Отправка сообщения человеку или в канал */
export function sendMessage(
  chatId: string | number,
  text: string,
  options: { disableNotification?: boolean } = {},
): Promise<unknown> {
  return call('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_notification: options.disableNotification ?? false,
  })
}

/**
 * Регистрация адреса, куда Telegram будет присылать уведомления.
 *
 * ⚠️ Список `allowed_updates` обязателен. Без явного упоминания
 * `chat_member` Telegram не пришлёт ни одного события о составе канала,
 * и подписки перестанут обновляться — молча, без единой ошибки в журнале.
 */
export function setWebhook(url: string, secretToken: string): Promise<boolean> {
  return call<boolean>('setWebhook', {
    url,
    secret_token: secretToken,
    allowed_updates: REQUIRED_UPDATE_TYPES,
    // Уведомления, накопившиеся за время простоя, не нужны:
    // актуальное состояние восстановит ночная сверка
    drop_pending_updates: true,
  })
}

export function deleteWebhook(): Promise<boolean> {
  return call<boolean>('deleteWebhook')
}

export type WebhookInfo = {
  url: string
  has_custom_certificate: boolean
  pending_update_count: number
  allowed_updates?: string[]
  last_error_date?: number
  last_error_message?: string
}

/** Что Telegram думает о нашем вебхуке. Нужно для диагностики */
export function getWebhookInfo(): Promise<WebhookInfo> {
  return call<WebhookInfo>('getWebhookInfo')
}

export const telegram = {
  isConfigured: isTelegramConfigured,
  getMe,
  getChatMember,
  sendMessage,
  setWebhook,
  deleteWebhook,
  getWebhookInfo,
}
