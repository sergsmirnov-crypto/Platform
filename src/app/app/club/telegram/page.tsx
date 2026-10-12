import { ArrowUpRight, MessageCircle } from 'lucide-react'

import { getSetting, SETTING_KEYS } from '@/modules/settings'
import type { TelegramChatLink } from '@/modules/settings'
import { routes } from '@/shared/routes'
import { EmptyState, PillLink } from '@/ui'

import { PageIntro } from '../../_components/page-intro'

export const metadata = { title: 'Чаты клуба' }

/**
 * Переходы в чаты Telegram.
 *
 * ─────────────────────────────────────────────────────────────────
 * КАРТОЧКИ С ОБЪЯСНЕНИЕМ, А НЕ СПИСОК ССЫЛОК
 *
 * «Общий чат», «Вопросы кураторам», «Идеи» — три ссылки подряд
 * не говорят человеку, куда идти со своим вопросом, и он не идёт
 * никуда. Поэтому у каждой карточки написано, зачем туда заходить.
 *
 * Счётчиков сообщений здесь нет по решению владельца продукта: они
 * повышают переходы, но требуют фоновой задачи, которая раз в час
 * ходит в Telegram. Вернёмся к ним вместе с уведомлениями.
 * ─────────────────────────────────────────────────────────────────
 *
 * Живое сообщество остаётся в Telegram, и платформа на него
 * не покушается: своего чата нет и не планируется (PRD v0.1, приложение А).
 */
export default async function TelegramLinksPage() {
  const chats = await getSetting<TelegramChatLink[]>(SETTING_KEYS.telegramChats)

  return (
    <>
      <PageIntro
        title="Чаты клуба"
        description="Общение живёт в Telegram — платформа хранит материалы, а разговоры идут там"
      />

      {chats.length === 0 ? (
        <EmptyState
          title="Ссылки на чаты ещё не заданы"
          description="Их добавляет владелец клуба в настройках платформы"
          className="border-border rounded-lg border border-dashed"
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {/* Ключ с номером: адрес у двух карточек может совпасть — например,
            две ветки одного чата, пока куратор не вписал точные ссылки */}
          {chats.map((chat, index) => (
            <li key={`${index}-${chat.url}`}>
              {/* Внешняя ссылка: новая вкладка и защита от подмены
                  открывшей страницы */}
              <a
                href={chat.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group border-border bg-surface-raised hover:border-border-strong flex min-h-20 items-start gap-3 rounded-xl border p-5 transition-colors"
              >
                <MessageCircle
                  size={20}
                  aria-hidden
                  className="text-content-subtle mt-0.5 shrink-0"
                />

                <span className="min-w-0 flex-1">
                  <span className="group-hover:text-accent-hover block font-medium transition-colors">
                    {chat.title}
                  </span>
                  <span className="text-content-muted block text-sm">{chat.description}</span>
                </span>

                <ArrowUpRight size={16} aria-hidden className="text-content-subtle shrink-0" />
              </a>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10">
        <PillLink href={routes.app.club.about()}>О клубе</PillLink>
      </div>
    </>
  )
}
