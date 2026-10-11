import { Radio } from 'lucide-react'
import Link from 'next/link'

import { formatArchiveDate, formatDuration, streamStrings } from '@/modules/streams'
import type { StreamCard } from '@/modules/streams'
import { routes } from '@/shared/routes'

/**
 * Эфиры, в которых разбирали эту песню.
 *
 * ─────────────────────────────────────────────────────────────────
 * ОБРАТНАЯ СТОРОНА СВЯЗИ — И БОЛЕЕ ПОЛЕЗНАЯ
 *
 * Со страницы эфира человек уходит к разбору песни; отсюда — к полутора
 * часам живого разбора именно её, с вопросами, ошибками и объяснениями,
 * которых в записи разбора нет.
 *
 * Блок появляется только если такие эфиры есть. Пустой заголовок
 * «Разбирали в эфирах» под каждой песней был бы шумом на двухстах
 * страницах ради двадцати, где связь заполнена.
 * ─────────────────────────────────────────────────────────────────
 *
 * Собирается слоем приложения: модуль разборов не знает об эфирах,
 * модуль эфиров — о том, как устроена страница песни. Тот же приём,
 * что со связанными разборами в уроке курса.
 */
export function SongStreams({ streams }: { streams: StreamCard[] }) {
  if (streams.length === 0) return null

  return (
    <section className="mt-12">
      <h2 className="font-display mb-4 text-xl font-bold">{streamStrings.page.inStreams}</h2>

      <ul className="grid gap-2 sm:grid-cols-2">
        {streams.map((stream) => (
          <li key={stream.id}>
            <Link
              href={routes.app.streams.stream(stream.slug)}
              className="border-border hover:bg-surface-hover flex min-h-14 items-center gap-3 rounded-lg border px-4 py-3 transition-colors"
            >
              <Radio size={18} className="text-content-subtle shrink-0" aria-hidden />

              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{stream.title}</span>
                <span className="text-content-muted block truncate text-sm">
                  {formatArchiveDate(stream.startsAt)}
                  {stream.durationSec ? ` · ${formatDuration(stream.durationSec)}` : ''}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
