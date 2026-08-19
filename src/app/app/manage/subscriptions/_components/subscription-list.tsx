import { subscriptionStrings } from '@/modules/subscription'
import type { SubscriptionListItem, SubscriptionOverview } from '@/modules/subscription'
import { routes } from '@/shared/routes'
import { Avatar, Badge, PillLink } from '@/ui'

/**
 * Список подписок и лента событий.
 *
 * В строке — только то, ради чего экран открывают: кто, в каком
 * состоянии, до какого числа и не оборвалась ли связь с Telegram.
 * Всё остальное — в карточке участника, куда ведёт строка.
 */

const BADGES = {
  active: { variant: 'outline' as const, label: subscriptionStrings.status.active },
  grace: { variant: 'accent' as const, label: subscriptionStrings.status.grace },
  expired: { variant: 'draft' as const, label: subscriptionStrings.status.expired },
  none: { variant: 'draft' as const, label: subscriptionStrings.status.none },
}

export function SubscriptionList({ items }: { items: SubscriptionListItem[] }) {
  if (items.length === 0) {
    return (
      <p className="border-border text-content-subtle rounded-lg border border-dashed p-6 text-sm">
        Ничего не подходит под отбор
      </p>
    )
  }

  return (
    <ul className="border-border divide-border divide-y overflow-hidden rounded-lg border">
      {items.map((item) => (
        <li key={item.userId}>
          <PillLink
            href={routes.app.manage.member(item.userId)}
            className="hover:bg-surface-hover flex min-h-16 w-full items-center gap-4 rounded-none border-0 px-4 py-3"
          >
            <Avatar src={item.avatarUrl} alt={item.displayName} size="sm" />

            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{item.displayName}</span>

              <span className="text-content-muted block truncate text-sm">
                {describeTerm(item)}
              </span>
            </span>

            {item.isUnreachable ? (
              <Badge variant="draft" size="sm">
                {subscriptionStrings.manage.unreachable}
              </Badge>
            ) : null}

            <Badge variant={BADGES[item.status].variant} size="sm">
              {BADGES[item.status].label}
            </Badge>
          </PillLink>
        </li>
      ))}
    </ul>
  )
}

/** Строка про сроки: показываем тот, который наступит первым */
function describeTerm(item: SubscriptionListItem): string {
  const parts: string[] = []

  if (item.source) parts.push(subscriptionStrings.source[item.source])
  if (item.graceUntil && item.status === 'grace') {
    parts.push(`доступ до ${formatDate(item.graceUntil)}`)
  } else if (item.validUntil) {
    parts.push(`до ${formatDate(item.validUntil)}`)
  }

  return parts.join(' · ') || '—'
}

export function SubscriptionEvents({ events }: { events: SubscriptionOverview['events'] }) {
  const strings = subscriptionStrings.manage

  if (events.length === 0) {
    return <p className="text-content-subtle text-sm">{strings.events.empty}</p>
  }

  const types = strings.eventTypes as Record<string, string>
  const sources = strings.eventSources as Record<string, string>

  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li key={event.id} className="text-sm">
          <p>
            <a href={routes.app.manage.member(event.userId)} className="hover:underline">
              {event.displayName}
            </a>{' '}
            <span className="text-content-muted">{types[event.eventType] ?? event.eventType}</span>
            {/* Событие от сверки означает, что уведомление не дошло:
                одно-два в месяц нормальны, поток — сломанный вебхук */}
            {event.source === 'reconcile' ? (
              <span className="text-danger"> · {strings.events.viaReconcile}</span>
            ) : (
              <span className="text-content-subtle">
                {' '}
                · {sources[event.source] ?? event.source}
              </span>
            )}
          </p>

          <p className="text-content-subtle text-xs">
            {formatDateTime(event.occurredAt)}
            {event.reason ? ` — ${event.reason}` : ''}
          </p>
        </li>
      ))}
    </ol>
  )
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date)
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
