'use client'

import { ArrowUpRight } from 'lucide-react'

import { markChatOpenedAction } from '../../_actions/checklist'

/**
 * Карточка перехода в чат клуба.
 *
 * Обычная ссылка, которая по пути отмечает, что человек в чат заглянул, —
 * это единственный пункт списка «Освойся в клубе», который иначе не узнать:
 * бот видит вступление в закрытый канал, но не чтение чата.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ОТМЕТКА НЕ ЗАДЕРЖИВАЕТ ПЕРЕХОД
 *
 * Соблазн — дождаться ответа сервера и только потом открыть Telegram.
 * Так нельзя: при медленной сети человек нажмёт второй раз, решив, что
 * не сработало, и получит две вкладки. А отметка о списке — не то, ради
 * чего стоит задерживать переход хотя бы на сотню миллисекунд.
 *
 * Поэтому вызов уходит и забывается. Потерянная отметка стоит ровно
 * одной лишней строки в списке — и та исчезнет при следующем нажатии.
 * ─────────────────────────────────────────────────────────────────
 */
export function ChatLink({
  url,
  title,
  description,
}: {
  url: string
  title: string
  description: string
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      onClick={() => {
        void markChatOpenedAction({})
      }}
      className="border-border bg-surface-raised hover:border-accent flex min-h-11 flex-col rounded-xl border p-4 transition-colors"
    >
      <span className="flex items-center gap-1.5 font-medium">
        {title}
        <ArrowUpRight size={15} aria-hidden className="text-content-subtle" />
      </span>
      <span className="text-content-muted mt-1 text-sm">{description}</span>
    </a>
  )
}
