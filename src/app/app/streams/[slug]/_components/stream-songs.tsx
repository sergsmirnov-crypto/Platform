import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

import { streamStrings } from '@/modules/streams'
import type { StreamSong } from '@/modules/streams'
import { routes } from '@/shared/routes'

/**
 * Разобранные в эфире песни.
 *
 * ─────────────────────────────────────────────────────────────────
 * СВЯЗЬ, КОТОРАЯ РАБОТАЕТ В ОБЕ СТОРОНЫ
 *
 * Отсюда человек уходит в разбор песни, о которой шла речь; со страницы
 * разбора — в эфир, где её разбирали живьём. Вторая сторона полезнее,
 * чем кажется: застрявший на песне находит полтора часа объяснений
 * именно про неё.
 *
 * Показываются только опубликованные разборы — отбор делает запрос
 * в модуле эфиров. Ссылка на черновик выглядела бы как поломка
 * платформы, а не как отсутствие разбора.
 * ─────────────────────────────────────────────────────────────────
 */
export function StreamSongs({ songs }: { songs: StreamSong[] }) {
  if (songs.length === 0) return null

  return (
    <section>
      <h2 className="font-display mb-1 text-xl font-bold">{streamStrings.page.songs}</h2>
      <p className="text-content-muted mb-4 text-sm">{streamStrings.page.songsHint}</p>

      <ul className="grid gap-2 sm:grid-cols-2">
        {songs.map((song) => (
          <li key={song.id}>
            <Link
              href={routes.app.learn.song(song.slug)}
              className="border-border hover:bg-surface-hover flex min-h-14 items-center gap-3 rounded-lg border px-4 py-3 transition-colors"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{song.title}</span>
                <span className="text-content-muted block truncate text-sm">{song.artist}</span>
              </span>

              <ArrowUpRight size={16} className="text-content-subtle shrink-0" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
