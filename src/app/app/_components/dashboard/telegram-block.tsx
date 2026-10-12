import { getSetting, SETTING_KEYS } from '@/modules/settings'
import type { TelegramChatLink } from '@/modules/settings'

import { ChatLink } from './chat-link'

/**
 * Переходы в чаты Telegram.
 *
 * Не «ссылка внизу страницы», а карточки с объяснением, зачем туда идти
 * (PRD v0.1 §7.6). Разница существенная: «Наш чат» открывают из
 * любопытства один раз, «Спросить куратора — отвечают за пару часов»
 * открывают, когда есть вопрос.
 *
 * Ссылки берутся из настроек платформы, а не зашиты в код: сообщество
 * переезжает между чатами, и ради этого не должен требоваться
 * разработчик. Пока настройка не заполнена — блока просто нет.
 *
 * Сами карточки — браузерный компонент: нажатие отмечает пункт «заглянуть
 * в чат» в списке «Освойся в клубе».
 */
export async function TelegramBlock() {
  const chats = await getSetting<TelegramChatLink[]>(SETTING_KEYS.telegramChats)

  if (chats.length === 0) return null

  return (
    <section>
      <h2 className="mb-3 text-lg font-bold">Общение клуба</h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Ключ с номером: адрес у двух карточек может совпасть — например,
            две ветки одного чата, пока куратор не вписал точные ссылки */}
        {chats.map((chat, index) => (
          <ChatLink
            key={`${index}-${chat.url}`}
            url={chat.url}
            title={chat.title}
            description={chat.description}
          />
        ))}
      </div>
    </section>
  )
}
