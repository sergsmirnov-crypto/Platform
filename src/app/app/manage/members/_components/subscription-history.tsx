import { subscriptionStrings } from '@/modules/subscription'

/**
 * История событий подписки конкретного человека.
 *
 * Отвечает на вопрос «что у него происходило» — тот самый, с которого
 * начинается разбор жалобы «мне не продлили». Порядок обратный: свежее
 * сверху, потому что искать почти всегда нужно последнее событие.
 *
 * Источник события показан наравне с самим событием: «вышел из канала
 * по сверке» и «вышел из канала по уведомлению» — разные истории.
 * Первая означает, что уведомление не дошло, и это уже вопрос к вебхуку.
 */

type Event = {
  id: string
  eventType: string
  source: string
  reason: string | null
  occurredAt: Date
}

const TYPES = subscriptionStrings.manage.eventTypes as Record<string, string>
const SOURCES = subscriptionStrings.manage.eventSources as Record<string, string>

export function SubscriptionHistory({ events }: { events: Event[] }) {
  if (events.length === 0) {
    return <p className="text-content-subtle text-sm">Событий пока не было</p>
  }

  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li key={event.id} className="text-sm">
          <p>
            <span>{TYPES[event.eventType] ?? event.eventType}</span>
            <span className="text-content-subtle"> · {SOURCES[event.source] ?? event.source}</span>
          </p>

          <p className="text-content-muted text-xs">
            {formatDateTime(event.occurredAt)}
            {event.reason ? ` — ${event.reason}` : ''}
          </p>
        </li>
      ))}
    </ol>
  )
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
