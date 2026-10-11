import { songStrings } from '@/modules/songs'
import type { SimilarSong } from '@/modules/songs'

import { SongCardItem } from '../../_components/song-card'

/**
 * Похожие разборы — то, что открыть следующим.
 *
 * Стоит внизу страницы намеренно: человек дочитал разбор до конца,
 * и это единственный момент, когда предложение «а вот ещё» не мешает,
 * а помогает. Работает на принцип «всегда есть что открыть»
 * (PRD v0.1 §1.3): дно страницы не должно быть тупиком.
 *
 * Карточки те же, что в каталоге, — не похожие, а буквально те же.
 * Своя карточка для подборки со временем разошлась бы с каталожной,
 * и одна и та же песня выглядела бы в двух местах по-разному.
 */

type SimilarSongsProps = {
  songs: SimilarSong[]
}

export function SimilarSongs({ songs }: SimilarSongsProps) {
  if (songs.length === 0) return null

  return (
    <section className="mt-14">
      <h2 className="font-display text-xl font-bold">{songStrings.song.similar}</h2>
      <p className="text-content-muted mt-1 text-sm">{songStrings.song.similarHint}</p>

      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">
        {songs.map((song) => (
          <SongCardItem key={song.id} song={song} />
        ))}
      </div>
    </section>
  )
}
