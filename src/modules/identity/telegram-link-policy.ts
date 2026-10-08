import type { TelegramUpdate, TelegramUser } from '@/shared/telegram'

/**
 * Разбор команды «Старт», с которой человек приходит в бота.
 *
 * Ссылка «Подключить Telegram» ведёт в бота с ключом: `t.me/бот?start=ключ`.
 * Нажав «Старт», человек отправляет боту сообщение `/start ключ`, и Telegram
 * пересылает его нам вместе со сведениями об отправителе. По ключу мы
 * узнаём аккаунт платформы, по отправителю — аккаунт Telegram.
 *
 * Чистая функция: сюда приходят данные из интернета произвольной формы,
 * и решение «что это значит» проверяется тестами отдельно от действий.
 */

export type StartCommand = {
  /** Ключ из ссылки. `null` — человек открыл бота сам, без ссылки с сайта */
  token: string | null
  from: TelegramUser
  /** Куда отвечать. В личной переписке совпадает с идентификатором человека */
  chatId: number
}

/**
 * Каким может быть ключ. Telegram пропускает в параметре `start` только
 * латиницу, цифры, `_` и `-`, не длиннее 64 символов. Строже, чем нужно
 * Telegram, — нельзя: ключ генерируется у нас (`generateToken`)
 */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/

export function parseStartCommand(update: TelegramUpdate): StartCommand | null {
  const message = update.message

  // Ключ принимаем только в личной переписке: в общем чате клуба команда
  // «/start» могла бы прийти от кого угодно с чужим ключом на виду у всех
  if (!message || message.chat.type !== 'private') return null
  if (!message.from || message.from.is_bot) return null

  const text = message.text?.trim()
  if (!text) return null

  const [command, payload] = text.split(/\s+/, 2)

  // Команда может прийти с именем бота: «/start@club_bot ключ»
  if (command?.split('@')[0] !== '/start') return null

  return {
    token: payload && TOKEN_PATTERN.test(payload) ? payload : null,
    from: message.from,
    chatId: message.chat.id,
  }
}

/** Чем закончилась попытка подключения */
export type LinkOutcome =
  | { kind: 'linked'; userId: string; telegramId: string }
  /** Тот же Telegram у того же аккаунта: человек нажал «Старт» второй раз */
  | { kind: 'already_linked'; userId: string; telegramId: string }
  /** Ключа нет, он использован или устарел */
  | { kind: 'expired' }
  /** Этот Telegram уже привязан к другому аккаунту платформы */
  | { kind: 'taken_by_other' }
  /** У аккаунта уже другой Telegram */
  | { kind: 'account_has_other' }

/**
 * Что делать с подключением, зная, кому уже принадлежат оба аккаунта.
 *
 * @param ownerOfTelegram   участник, к которому этот Telegram уже привязан
 * @param telegramOfAccount Telegram, уже привязанный к аккаунту из ключа
 */
export function decideLink(input: {
  userId: string
  telegramId: string
  ownerOfTelegram: string | null
  telegramOfAccount: string | null
}): LinkOutcome | { kind: 'attach' } {
  const { userId, telegramId, ownerOfTelegram, telegramOfAccount } = input

  if (ownerOfTelegram === userId) return { kind: 'already_linked', userId, telegramId }

  /*
   * Чужой Telegram не переносится молча. Это мог быть второй аккаунт
   * того же человека — с другой почтой, — и перенос оставил бы первый
   * аккаунт без подписки. А мог быть и чужой телефон в руках. Решает
   * человек, а не автоматика: сообщение объясняет, что делать.
   */
  if (ownerOfTelegram !== null) return { kind: 'taken_by_other' }
  if (telegramOfAccount !== null) return { kind: 'account_has_other' }

  return { kind: 'attach' }
}
