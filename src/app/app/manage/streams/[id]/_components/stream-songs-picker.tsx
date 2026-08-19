'use client'

import { Search, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { streamStrings } from '@/modules/streams'
import { Button, Input } from '@/ui'

import { saveStreamSongsAction } from '../../_actions/stream-editor'

/**
 * Разобранные в эфире песни.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОИСК, А НЕ СПИСОК ИЗ ДВУХСОТ СТРОК
 *
 * Разборов в клубе двести, и выпадающий список из двухсот названий
 * не помогает никому — ни на телефоне, ни на большом экране. Куратор
 * помнит, что разбирал Nothing Else Matters, и печатает три буквы.
 *
 * Поиск идёт по уже загруженному списку, а не запросами к серверу:
 * двести названий — это несколько килобайт, они приезжают вместе
 * со страницей, и отбор происходит мгновенно, без задержек и мигания.
 * Когда разборов станет тысяча, здесь появится обращение к серверу —
 * и это будет единственное изменение.
 * ─────────────────────────────────────────────────────────────────
 *
 * Связь двусторонняя: отмеченная здесь песня получает на своей странице
 * ссылку на этот эфир.
 */

type Song = { id: string; title: string; artist: string }

type StreamSongsPickerProps = {
  streamId: string
  songs: Song[]
  /** Все разборы, из которых можно выбирать */
  options: Song[]
  canEdit: boolean
}

export function StreamSongsPicker({ streamId, songs, options, canEdit }: StreamSongsPickerProps) {
  const strings = streamStrings.manage.songs
  const router = useRouter()

  const [selected, setSelected] = useState<Song[]>(songs)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const found = query.trim()
    ? options
        .filter((song) => !selected.some((item) => item.id === song.id))
        .filter((song) => matches(song, query))
        .slice(0, 8)
    : []

  function save(next: Song[]): void {
    setError(null)
    setSelected(next)

    startTransition(async () => {
      const result = await saveStreamSongsAction({
        streamId,
        songIds: next.map((song) => song.id),
      })

      if (!result.ok) {
        setError(result.message)
        return
      }

      router.refresh()
    })
  }

  return (
    <div>
      <p className="text-content-muted mb-4 text-sm">{strings.hint}</p>

      {selected.length === 0 ? (
        <p className="text-content-muted mb-4 text-sm">{strings.empty}</p>
      ) : (
        <ul className="mb-4 flex flex-wrap gap-2">
          {selected.map((song) => (
            <li
              key={song.id}
              className="border-border flex items-center gap-2 rounded-full border py-1 pr-1 pl-4 text-sm"
            >
              <span>
                {song.title}
                <span className="text-content-muted"> · {song.artist}</span>
              </span>

              {canEdit ? (
                <button
                  type="button"
                  disabled={pending}
                  aria-label={`${strings.remove}: ${song.title}`}
                  onClick={() => save(selected.filter((item) => item.id !== song.id))}
                  className="text-content-subtle hover:text-danger flex size-8 items-center justify-center rounded-full"
                >
                  <X size={14} aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <div className="relative max-w-md">
          <Search
            size={18}
            aria-hidden
            className="text-content-subtle pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={strings.search}
            aria-label={strings.search}
            className="pl-10"
          />

          {found.length > 0 ? (
            <ul className="border-border bg-surface-raised mt-2 overflow-hidden rounded-lg border">
              {found.map((song) => (
                <li key={song.id}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start rounded-none"
                    disabled={pending}
                    onClick={() => {
                      save([...selected, song])
                      setQuery('')
                    }}
                  >
                    {song.title}
                    <span className="text-content-muted"> · {song.artist}</span>
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-danger mt-3 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** Совпадение по названию или исполнителю, без учёта регистра */
function matches(song: Song, query: string): boolean {
  const needle = query.trim().toLowerCase()

  return song.title.toLowerCase().includes(needle) || song.artist.toLowerCase().includes(needle)
}
