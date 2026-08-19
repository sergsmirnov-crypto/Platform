import { logStrings } from '@/modules/audit'
import type { AuditEntry } from '@/modules/audit'

/**
 * Последние действия команды.
 *
 * Тот же порядок слов, что и в журнале: кто, что сделал, над чем.
 * Но без отбора, без раскрытия подробностей и без ссылок — здесь это
 * не инструмент разбора, а боковое зрение: «Мария вчера что-то правила
 * в курсе». Кому нужно разобраться, нажмёт на заголовок и попадёт
 * в журнал, где всё это есть.
 *
 * Показывается только тем, у кого есть право `audit.view`, — данные
 * сюда просто не запрашиваются без него.
 */
export function RecentActions({ entries }: { entries: AuditEntry[] }) {
  return (
    <ul className="border-border divide-border divide-y overflow-hidden rounded-lg border text-sm">
      {entries.map((entry) => (
        <li key={entry.id} className="flex flex-wrap items-baseline gap-x-2 px-4 py-2.5">
          <time
            dateTime={entry.at.toISOString()}
            className="text-content-subtle shrink-0 text-xs tabular-nums"
          >
            {formatWhen(entry.at)}
          </time>

          <span className="font-medium">{entry.actor?.name ?? logStrings.entry.system}</span>
          <span className="text-content-muted">{entry.label}</span>

          {entry.entity?.title ? (
            <span className="min-w-0 truncate">{entry.entity.title}</span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

/**
 * Время или день недели.
 *
 * Сегодняшнее показывается часами, вчерашнее и старше — днём недели.
 * Точная дата на этом экране не нужна: он про «что происходило
 * на днях», а не про расследование.
 */
function formatWhen(date: Date): string {
  const isToday = date.toDateString() === new Date().toDateString()

  return new Intl.DateTimeFormat(
    'ru-RU',
    isToday ? { hour: '2-digit', minute: '2-digit' } : { weekday: 'short' },
  ).format(date)
}
