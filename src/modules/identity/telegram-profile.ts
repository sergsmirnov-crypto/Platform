/**
 * Сведения о человеке из Telegram в том виде, в каком их хранит платформа.
 *
 * Общие для двух путей: входа через виджет (выключен по умолчанию,
 * ADR-0030) и подключения Telegram через бота. Оба получают от Telegram
 * одинаковый набор полей, и разойтись в том, как из них собирается имя,
 * они не должны.
 */

/**
 * Имя нового участника, пока он не назвался.
 *
 * Вошедший по почте получает его при создании аккаунта; при подключении
 * Telegram оно заменяется именем оттуда (`attachTelegramIdentity`).
 * Имя, выбранное человеком, не заменяется никогда
 */
export const DEFAULT_DISPLAY_NAME = 'Участник клуба'

export type TelegramPerson = {
  first_name: string
  last_name?: string | undefined
  username?: string | undefined
  photo_url?: string | undefined
}

/** Имя для показа, собранное из того, что прислал Telegram */
export function displayNameFromTelegram(person: TelegramPerson): string {
  const name = [person.first_name, person.last_name].filter(Boolean).join(' ').trim()

  // У человека может не быть имени в Telegram — тогда берём имя пользователя
  return name || person.username || DEFAULT_DISPLAY_NAME
}

/**
 * Всё, что прислал Telegram, — для поддержки и поиска.
 *
 * Имя пользователя отсюда берёт водяной знак на видео (`findTelegramUsername`).
 */
export function providerDataFromTelegram(person: TelegramPerson): Record<string, unknown> {
  return {
    firstName: person.first_name,
    ...(person.last_name ? { lastName: person.last_name } : {}),
    ...(person.username ? { username: person.username } : {}),
    ...(person.photo_url ? { photoUrl: person.photo_url } : {}),
    lastLoginAt: new Date().toISOString(),
  }
}
