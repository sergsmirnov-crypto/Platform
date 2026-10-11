import { songStrings, tuningLabel } from '@/modules/songs'
import type { SongView } from '@/modules/songs'
import { Badge, PropertyList, SongCover } from '@/ui'
import type { Property } from '@/ui'

/**
 * Шапка страницы разбора.
 *
 * Отвечает на вопрос «та ли это песня и подойдёт ли она мне», который
 * человек задаёт в первые две секунды. Поэтому наверху ровно то, что
 * решает: название, исполнитель и свойства инструмента.
 *
 * Строй стоит среди свойств не случайно и не для полноты: человек
 * не станет перестраивать гитару ради одной песни, и увидеть «DADGAD»
 * он должен раньше, чем начнёт читать описание (PRD v0.1 §12, пункт 8).
 *
 * Обложка на телефоне уезжает наверх и сжимается: она украшение,
 * а место на первом экране принадлежит названию и свойствам.
 */

type SongHeroProps = {
  song: SongView
}

export function SongHero({ song }: SongHeroProps) {
  const properties: Property[] = [
    { label: songStrings.properties.tuning, value: tuningLabel(song.tuning) },
    {
      label: songStrings.properties.capo,
      value: song.capo ? songStrings.properties.capoValue(song.capo) : null,
    },
    {
      label: songStrings.properties.tempo,
      value: song.tempoBpm ? songStrings.properties.tempoValue(song.tempoBpm) : null,
    },
    { label: songStrings.properties.key, value: song.musicKey },
  ]

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
      <div className="w-32 shrink-0 sm:w-48">
        <SongCover title={song.title} artist={song.artist} seed={song.slug} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-content-muted text-sm">
          {song.artist}
          {song.year ? ` · ${song.year}` : ''}
          {song.album ? ` · ${song.album}` : ''}
        </p>

        <h1 className="font-display mt-1 text-3xl leading-tight font-extrabold sm:text-4xl">
          {song.title}
        </h1>

        {/* Черновик обязан быть заметным: куратор, не увидевший метку,
            решит, что разбор уже опубликован, и не нажмёт «Опубликовать» */}
        {!song.isPublic ? (
          <p className="mt-3">
            <Badge variant="draft">
              {song.status === 'scheduled'
                ? songStrings.status.scheduled
                : song.status === 'archived'
                  ? songStrings.status.archived
                  : songStrings.status.draft}
            </Badge>
          </p>
        ) : null}

        <PropertyList items={properties} className="mt-3" />

        {song.tags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {song.tags.map((tag) => (
              <Badge key={tag.id} variant="outline" size="sm">
                {tag.name}
              </Badge>
            ))}
          </div>
        ) : null}

        {song.description ? (
          <p className="text-content-muted mt-5 max-w-prose leading-relaxed">{song.description}</p>
        ) : null}
      </div>
    </div>
  )
}
