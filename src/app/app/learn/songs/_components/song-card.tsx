import Link from 'next/link'

import { levelLabel, songStrings } from '@/modules/songs'
import type { SongCard as SongCardData } from '@/modules/songs'
import { routes } from '@/shared/routes'
import { Badge, Highlight } from '@/ui'
import { SongCover } from '@/ui/patterns/song-cover'

/**
 * Карточка песни в каталоге.
 *
 * Что на ней есть и почему именно это: название и исполнитель — чтобы
 * узнать песню; уровни — чтобы понять, есть ли разбор по силам; строй —
 * чтобы понять, придётся ли перестраивать гитару. Всё остальное
 * (год, альбом, длительность) на этапе выбора не помогает и только
 * загромождает сетку.
 *
 * Ссылкой сделана вся карточка целиком, а не название: попасть пальцем
 * в строку текста на телефоне трудно, а промах по карточке невозможен.
 */

type SongCardProps = {
  song: SongCardData
  /** Слова из поискового запроса — подсветить, за что зацепился поиск */
  terms?: string[]
}

export function SongCardItem({ song, terms = [] }: SongCardProps) {
  return (
    <Link
      href={routes.app.learn.song(song.slug)}
      className="group focus-visible:outline-focus-ring block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      <div className="relative">
        <SongCover
          title={song.title}
          artist={song.artist}
          seed={song.slug}
          className="transition-transform duration-150 group-hover:-translate-y-0.5"
        />

        {/* Черновики видны только кураторам — метка обязана быть заметной,
            иначе куратор решит, что разбор уже опубликован */}
        {!song.isPublic ? (
          <span className="absolute top-3 right-3">
            <Badge variant="draft" size="sm">
              {song.status === 'scheduled'
                ? songStrings.status.scheduled
                : song.status === 'archived'
                  ? songStrings.status.archived
                  : songStrings.status.draft}
            </Badge>
          </span>
        ) : null}
      </div>

      <div className="mt-3">
        <p className="group-hover:text-accent-hover leading-snug font-medium transition-colors">
          <Highlight text={song.title} terms={terms} />
        </p>
        <p className="text-content-muted text-sm">
          <Highlight text={song.artist} terms={terms} />
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {song.levels.map((level) => (
            <Badge key={level} variant="outline" size="sm">
              {levelLabel(level)}
            </Badge>
          ))}

          {song.tuningLabel ? (
            <span className="text-content-subtle text-xs">{song.tuningLabel}</span>
          ) : null}

          {song.levels.length === 0 ? (
            <span className="text-content-subtle text-xs">{songStrings.song.noArrangements}</span>
          ) : null}
        </div>
      </div>
    </Link>
  )
}
