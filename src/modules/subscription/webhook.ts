import { isInChannel } from '@/shared/telegram/membership'
import type { TelegramChatMemberUpdated, TelegramUpdate } from '@/shared/telegram/types'

/**
 * Разбор уведомлений Telegram об изменении состава канала.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЧИСТЫЕ ФУНКЦИИ: НИ БАЗЫ, НИ СЕТИ
 *
 * Сюда приходит то, что прислал Telegram, — то есть данные из интернета,
 * произвольной формы и любой степени неожиданности. Решение «что это
 * значит» отделено от «что с этим сделать» ровно потому, что первое
 * можно проверить тестами, а второе — нет.
 *
 * Цена ошибки здесь прямая: неверно истолкованное уведомление отбирает
 * доступ у человека, который заплатил.
 * ─────────────────────────────────────────────────────────────────
 */

/** Что означает пришедшее уведомление */
export type WebhookVerdict =
  /** Состав закрытого канала изменился: главный сигнал об оплате и отмене */
  | {
      kind: 'membership'
      telegramId: string
      isMember: boolean
      status: string
      occurredAt: Date
    }
  /**
   * Изменились права самого бота.
   *
   * Отдельный случай, и очень важный: если бота лишили администратора,
   * уведомления `chat_member` перестают приходить — молча, без единой
   * ошибки. Платформа продолжит работать по последнему известному
   * состоянию и не заметит, что связь с Telegram оборвалась
   */
  | { kind: 'bot_status'; isAdmin: boolean; status: string }
  /** Уведомление не про нас: другой чат, сообщение, вход бота */
  | { kind: 'ignored'; reason: string }

/** Статусы, при которых бот видит состав канала */
const BOT_ADMIN_STATUSES = new Set(['administrator', 'creator'])

/**
 * Толкует уведомление.
 *
 * @param channelId идентификатор закрытого канала. Пусто означает,
 *                  что канал не настроен, — тогда обрабатывать нечего
 */
export function interpretUpdate(
  update: TelegramUpdate,
  channelId: string | null | undefined,
): WebhookVerdict {
  if (update.my_chat_member) {
    return interpretBotStatus(update.my_chat_member, channelId)
  }

  if (!update.chat_member) {
    // Сообщения боту и прочее: платформа их не обрабатывает,
    // но и ошибкой это не является
    return { kind: 'ignored', reason: 'не событие о составе канала' }
  }

  return interpretMembership(update.chat_member, channelId)
}

function interpretMembership(
  event: TelegramChatMemberUpdated,
  channelId: string | null | undefined,
): WebhookVerdict {
  if (!channelId) {
    return { kind: 'ignored', reason: 'закрытый канал не настроен' }
  }

  if (String(event.chat.id) !== String(channelId)) {
    // Бот может состоять и в других чатах: общий чат клуба, чат кураторов.
    // Их состав к подписке отношения не имеет
    return { kind: 'ignored', reason: 'другой чат' }
  }

  const member = event.new_chat_member

  if (member.user.is_bot) {
    return { kind: 'ignored', reason: 'участник — бот' }
  }

  return {
    kind: 'membership',
    telegramId: String(member.user.id),
    isMember: isInChannel(member),
    status: member.status,
    // Telegram присылает время в секундах, а не в миллисекундах:
    // без множителя все события окажутся в январе 1970 года
    occurredAt: new Date(event.date * 1000),
  }
}

function interpretBotStatus(
  event: TelegramChatMemberUpdated,
  channelId: string | null | undefined,
): WebhookVerdict {
  if (!channelId || String(event.chat.id) !== String(channelId)) {
    return { kind: 'ignored', reason: 'другой чат' }
  }

  return {
    kind: 'bot_status',
    isAdmin: BOT_ADMIN_STATUSES.has(event.new_chat_member.status),
    status: event.new_chat_member.status,
  }
}

/**
 * Совпадает ли секрет, присланный Telegram.
 *
 * Адрес вебхука рано или поздно станет известен — он открыт для запросов
 * из интернета. Секрет в заголовке — единственное, что отличает Telegram
 * от того, кто решил подарить себе подписку поддельным уведомлением.
 *
 * Сравнение посимвольное с накоплением: обычное `===` завершается
 * на первом несовпадении, и по времени ответа секрет подбирается
 * по одному символу.
 */
export function isWebhookSecretValid(
  received: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!expected) return false
  if (!received) return false
  if (received.length !== expected.length) return false

  let diff = 0
  for (let i = 0; i < expected.length; i += 1) {
    diff |= received.charCodeAt(i) ^ expected.charCodeAt(i)
  }

  return diff === 0
}
