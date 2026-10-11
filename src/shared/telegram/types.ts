/**
 * Типы данных Telegram Bot API.
 *
 * Описаны только те поля, которые платформа действительно использует.
 * Полная копия документации здесь не нужна и быстро устареет: чем меньше
 * описано, тем меньше придётся править, когда Telegram что-то добавит.
 *
 * Официальная документация: https://core.telegram.org/bots/api
 */

/** Человек в терминах Telegram */
export type TelegramUser = {
  id: number
  is_bot?: boolean
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

/**
 * Состояние человека в канале.
 *
 * `creator` и `administrator` — владелец и админы канала.
 * `member` — обычный подписчик.
 * `restricted` — ограничен в правах; при этом может как оставаться
 * в канале, так и быть выведенным из него (различается полем `is_member`).
 * `left` — вышел сам, `kicked` — удалён администратором или ботом Tribute.
 */
export type TelegramChatMemberStatus =
  'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked'

export type TelegramChatMember = {
  status: TelegramChatMemberStatus
  user: TelegramUser
  /** Только для статуса `restricted`: находится ли человек всё ещё в канале */
  is_member?: boolean
  /** Только для статуса `kicked`: до какого момента действует блокировка */
  until_date?: number
}

/**
 * Изменение состава канала.
 *
 * Приходит в уведомлении `chat_member`, когда бот — администратор канала.
 * Именно это событие является сигналом об оплате и отмене подписки:
 * Tribute добавляет человека в канал, Telegram присылает нам событие.
 */
export type TelegramChatMemberUpdated = {
  chat: { id: number; title?: string; type: string }
  from: TelegramUser
  date: number
  old_chat_member: TelegramChatMember
  new_chat_member: TelegramChatMember
}

export type TelegramMessage = {
  message_id: number
  from?: TelegramUser
  chat: { id: number; type: string }
  date: number
  text?: string
}

/** Уведомление от Telegram. Ровно одно из полей заполнено. */
export type TelegramUpdate = {
  update_id: number
  message?: TelegramMessage
  /** Изменение состава канала или чата */
  chat_member?: TelegramChatMemberUpdated
  /** Изменение прав самого бота: например, его лишили администратора */
  my_chat_member?: TelegramChatMemberUpdated
}

/**
 * Типы уведомлений, которые платформа просит присылать.
 *
 * ⚠️ Критично: `chat_member` НЕ приходит по умолчанию. Telegram шлёт его
 * только если тип явно перечислен при регистрации вебхука. Это самая частая
 * причина ситуации «код написан, вебхук зарегистрирован, событий нет».
 * Поэтому список задан константой и используется скриптом регистрации.
 */
export const REQUIRED_UPDATE_TYPES = ['message', 'chat_member', 'my_chat_member'] as const

/** Ответ Telegram Bot API: успех либо описание ошибки */
export type TelegramApiResponse<T> =
  | { ok: true; result: T }
  | { ok: false; error_code: number; description: string; parameters?: { retry_after?: number } }

/** Данные, которые возвращает виджет входа Telegram */
export type TelegramAuthData = {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
}
