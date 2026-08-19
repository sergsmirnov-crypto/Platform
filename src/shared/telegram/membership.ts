import type { TelegramChatMember, TelegramChatMemberStatus } from './types'

/**
 * Толкование состояния человека в канале.
 *
 * Вынесено в отдельную чистую функцию, потому что здесь легко ошибиться,
 * а цена ошибки — потеря доступа у платящего участника.
 *
 * Тонкость, из-за которой и написан этот файл: статус `restricted`
 * сам по себе ничего не говорит о членстве. Человек с ограничением прав
 * может как оставаться в канале, так и быть выведенным из него — это
 * различается отдельным полем `is_member`. Если считать `restricted`
 * выходом из канала, ограничение прав отберёт оплаченный доступ.
 */

/** Статусы, при которых человек безусловно находится в канале */
const PRESENT_STATUSES = new Set<TelegramChatMemberStatus>(['creator', 'administrator', 'member'])

/**
 * Находится ли человек в канале сейчас.
 *
 * @param member состояние из `getChatMember` или из уведомления `chat_member`.
 *               `null` означает, что Telegram такого участника не знает
 */
export function isInChannel(member: TelegramChatMember | null | undefined): boolean {
  if (!member) return false

  if (PRESENT_STATUSES.has(member.status)) return true

  // Ограниченный в правах остаётся участником, пока не сказано обратное
  if (member.status === 'restricted') return member.is_member === true

  // left, kicked — человек вне канала
  return false
}
