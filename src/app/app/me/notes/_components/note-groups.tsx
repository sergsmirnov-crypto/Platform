import { Clock } from 'lucide-react'
import Link from 'next/link'

import { libraryStrings } from '@/modules/library'
import { formatTimecode } from '@/shared/utils/timecode'

import { noteHref } from '../../../_lib/notes'

import type { NoteGroup } from '../../../_lib/notes'

/**
 * Заметки, разложенные по записям.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗДЕСЬ ЗАМЕТКИ ЧИТАЮТ, А НЕ ПРАВЯТ
 *
 * Правка живёт на странице записи, и переносить её сюда было бы
 * ошибкой: заметку меняют, когда снова упёрлись в то же место, —
 * то есть с открытым видео. Здесь же человек ищет, к чему вернуться.
 *
 * Поэтому кода в браузере на этой странице нет вовсе: каждая заметка —
 * ссылка, ведущая на запись, открытую на нужной секунде.
 * ─────────────────────────────────────────────────────────────────
 */
export function NoteGroups({ groups }: { groups: NoteGroup[] }) {
  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={`${group.target.entityType}:${group.target.entityId}`}>
          <h2 className="mb-3">
            <Link href={group.target.href} className="hover:text-content-muted">
              <span className="text-content-muted block text-xs">
                {libraryStrings.kindOfNote[group.target.entityType]}
              </span>
              <span className="font-display text-lg font-bold">{group.target.title}</span>
              {group.target.subtitle ? (
                <span className="text-content-muted ml-2 text-sm">{group.target.subtitle}</span>
              ) : null}
            </Link>
          </h2>

          <ul className="border-border divide-border divide-y overflow-hidden rounded-xl border">
            {group.notes.map((note) => (
              <li key={note.id}>
                <Link
                  href={noteHref(group.target, note.timecodeSec)}
                  className="hover:bg-surface-hover flex gap-3 p-4 transition-colors"
                >
                  {note.timecodeSec !== null ? (
                    <span className="text-content-muted inline-flex shrink-0 items-center gap-1.5 text-sm tabular-nums">
                      <Clock size={14} aria-hidden />
                      {formatTimecode(note.timecodeSec)}
                    </span>
                  ) : null}

                  {/* Переносы строк сохраняем: заметку пишут списком
                      подходов, и в одну строку она нечитаема */}
                  <span className="min-w-0 flex-1 whitespace-pre-wrap">{note.body}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
