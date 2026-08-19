import Link from 'next/link'

import { logStrings } from '@/modules/audit'
import type { AuditEntry, LogFilters } from '@/modules/audit'
import { Badge } from '@/ui'

import { LogDiff } from './log-diff'
import { logHref } from './log-filters'

/**
 * Одна запись журнала.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОРЯДОК СЛОВ В СТРОКЕ ВЫБРАН НЕ СЛУЧАЙНО
 *
 * «Время · Кто · Что сделал · Над чем». Взгляд идёт слева направо
 * и останавливается на названии — а ищут почти всегда именно
 * по названию: «где мой разбор». Если поставить название первым,
 * список перестанет читаться как лента событий.
 *
 * Имя и название — ссылки на отбор, а не на сами объекты. Ссылка
 * на объект была бы честной ровно до первого удаления, а половина
 * интересных записей — про удалённое.
 * ─────────────────────────────────────────────────────────────────
 */

export function LogDayGroup({
  day,
  entries,
  filters,
}: {
  day: string
  entries: AuditEntry[]
  filters: LogFilters
}) {
  return (
    <section>
      <h2 className="text-content-muted mb-2 text-xs font-semibold tracking-wide uppercase">
        {formatDayHeading(day)}
      </h2>

      <ul className="border-border divide-border divide-y overflow-hidden rounded-lg border">
        {entries.map((entry) => (
          <li key={entry.id} className="px-4 py-3">
            <LogEntryRow entry={entry} filters={filters} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function LogEntryRow({ entry, filters }: { entry: AuditEntry; filters: LogFilters }) {
  return (
    <div className="text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <time
          dateTime={entry.at.toISOString()}
          className="text-content-subtle w-11 shrink-0 tabular-nums"
        >
          {formatTime(entry.at)}
        </time>

        {entry.actor ? (
          <Link
            href={logHref(filters, { actorId: entry.actor.id, entity: null })}
            title={logStrings.entry.byActor}
            className="hover:decoration-content font-medium underline decoration-transparent underline-offset-4 transition-colors"
          >
            {entry.actor.name}
          </Link>
        ) : (
          <span className="text-content-muted">{logStrings.entry.system}</span>
        )}

        <span className="text-content-muted">{entry.label}</span>

        {entry.entity ? (
          <Link
            href={logHref(filters, {
              entity: { type: entry.entity.type, id: entry.entity.id },
              actorId: null,
            })}
            title={logStrings.entry.byEntity}
            className="hover:decoration-content underline decoration-transparent underline-offset-4 transition-colors"
          >
            {entry.entity.title ?? (
              <span className="text-content-subtle italic">{logStrings.entry.unnamed}</span>
            )}
          </Link>
        ) : null}

        {entry.isNotable ? (
          <Badge variant="outline" size="sm">
            важное
          </Badge>
        ) : null}
      </div>

      <LogDiff diff={entry.diff} />
    </div>
  )
}

/**
 * Заголовок дня.
 *
 * «Сегодня» и «Вчера» вместо даты: именно этими словами человек и думает,
 * когда открывает журнал из-за того, что случилось только что.
 */
function formatDayHeading(day: string): string {
  const date = new Date(`${day}T00:00:00Z`)
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  if (day === today) return logStrings.today
  if (day === yesterday) return logStrings.yesterday

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    weekday: 'short',
  }).format(date)
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date)
}
