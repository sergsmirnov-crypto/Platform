'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { routes } from '@/shared/routes'
import { Button, Field, Input, Textarea } from '@/ui'

import { createSongAction, saveSongAction } from '../_actions/song-editor'

/**
 * Поля песни.
 *
 * Одна форма и для создания, и для правки: поля те же, и две почти
 * одинаковые формы неизбежно разошлись бы — в одной появилась бы
 * тональность, в другой нет.
 *
 * Обязательных полей два. Всё остальное куратор часто не знает наизусть
 * и заполняет позже; требовать их означало бы вынудить выдумывать,
 * а выдуманные данные хуже отсутствующих — по ним фильтруют.
 *
 * Ошибки приходят с сервера разложенными по полям, поэтому подсвечивается
 * именно то поле, где проблема, а не показывается общее «проверьте данные».
 */

type Tag = { id: string; name: string; kind: 'genre' | 'technique' | 'mood' }

type SongFormProps = {
  tags: Tag[]
  song?: {
    id: string
    title: string
    artist: string
    album: string | null
    year: number | null
    description: string | null
    tuning: string | null
    capo: number | null
    tempoBpm: number | null
    musicKey: string | null
    tagIds: string[]
  }
}

const KIND_TITLES: Record<Tag['kind'], string> = {
  genre: 'Жанр',
  technique: 'Приёмы',
  mood: 'Настроение',
}

export function SongForm({ tags, song }: SongFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const [title, setTitle] = useState(song?.title ?? '')
  const [artist, setArtist] = useState(song?.artist ?? '')
  const [album, setAlbum] = useState(song?.album ?? '')
  const [year, setYear] = useState(
    song?.year === null || song === undefined ? '' : String(song.year),
  )
  const [description, setDescription] = useState(song?.description ?? '')
  const [tuning, setTuning] = useState(song?.tuning ?? '')
  const [capo, setCapo] = useState(
    song?.capo === null || song === undefined ? '' : String(song.capo),
  )
  const [tempo, setTempo] = useState(
    song?.tempoBpm === null || song === undefined ? '' : String(song.tempoBpm),
  )
  const [musicKey, setMusicKey] = useState(song?.musicKey ?? '')
  const [tagIds, setTagIds] = useState<string[]>(song?.tagIds ?? [])

  function values() {
    return {
      title,
      artist,
      album,
      // Пустая строка едет как есть: превращение в «не заполнено» —
      // работа схемы на сервере, и делать её дважды значит однажды
      // сделать по-разному
      year,
      description,
      tuning,
      capo,
      tempoBpm: tempo,
      musicKey,
      tagIds,
    }
  }

  function handleSubmit() {
    setErrors({})
    setSavedAt(null)

    startTransition(async () => {
      const result = song
        ? await saveSongAction({ songId: song.id, values: values() })
        : await createSongAction(values())

      if (!result.ok) {
        setErrors(result.fields ?? { form: result.message })
        return
      }

      if (song) {
        setSavedAt(Date.now())
        router.refresh()
      } else {
        router.push(routes.app.manage.song(result.data.songId))
      }
    })
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Field label="Название" htmlFor="title" error={errors.title}>
        <Input
          id="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-invalid={Boolean(errors.title)}
          placeholder="Nothing Else Matters"
        />
      </Field>

      <Field label="Исполнитель" htmlFor="artist" error={errors.artist}>
        <Input
          id="artist"
          value={artist}
          onChange={(event) => setArtist(event.target.value)}
          aria-invalid={Boolean(errors.artist)}
          placeholder="Metallica"
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Альбом" htmlFor="album" error={errors.album}>
          <Input id="album" value={album} onChange={(event) => setAlbum(event.target.value)} />
        </Field>

        <Field label="Год" htmlFor="year" error={errors.year}>
          <Input
            id="year"
            inputMode="numeric"
            value={year}
            onChange={(event) => setYear(event.target.value)}
            aria-invalid={Boolean(errors.year)}
          />
        </Field>
      </div>

      {/* Свойства инструмента вместе: куратор заполняет их одним заходом,
          глядя в свои же заметки к разбору */}
      <div className="grid gap-6 sm:grid-cols-3">
        <Field label="Строй" htmlFor="tuning" hint="E standard, Drop D…" error={errors.tuning}>
          <Input id="tuning" value={tuning} onChange={(event) => setTuning(event.target.value)} />
        </Field>

        <Field label="Каподастр" htmlFor="capo" hint="Лад" error={errors.capo}>
          <Input
            id="capo"
            inputMode="numeric"
            value={capo}
            onChange={(event) => setCapo(event.target.value)}
            aria-invalid={Boolean(errors.capo)}
          />
        </Field>

        <Field label="Темп" htmlFor="tempo" hint="Ударов в минуту" error={errors.tempoBpm}>
          <Input
            id="tempo"
            inputMode="numeric"
            value={tempo}
            onChange={(event) => setTempo(event.target.value)}
            aria-invalid={Boolean(errors.tempoBpm)}
          />
        </Field>
      </div>

      <Field label="Тональность" htmlFor="key" hint="Em, C#m…" error={errors.musicKey}>
        <Input
          id="key"
          className="sm:max-w-40"
          value={musicKey}
          onChange={(event) => setMusicKey(event.target.value)}
        />
      </Field>

      <Field
        label="Описание"
        htmlFor="description"
        hint="Что освоит участник, на что обратить внимание"
        error={errors.description}
      >
        <Textarea
          id="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          aria-invalid={Boolean(errors.description)}
        />
      </Field>

      <TagPicker tags={tags} selected={tagIds} onChange={setTagIds} titles={KIND_TITLES} />

      {errors.form ? <p className="text-danger text-sm">{errors.form}</p> : null}

      <div className="flex items-center gap-4">
        <Button onClick={handleSubmit} disabled={pending}>
          {pending ? 'Сохраняю…' : song ? 'Сохранить' : 'Создать черновик'}
        </Button>

        {savedAt ? <span className="text-content-muted text-sm">Сохранено</span> : null}
      </div>
    </div>
  )
}

/**
 * Выбор меток.
 *
 * Метки сгруппированы по виду: жанр, приёмы, настроение. Плоский список
 * из сорока значений куратор не читает — он ставит первые попавшиеся,
 * и фильтры каталога перестают работать.
 */
function TagPicker({
  tags,
  selected,
  onChange,
  titles,
}: {
  tags: Tag[]
  selected: string[]
  onChange: (next: string[]) => void
  titles: Record<Tag['kind'], string>
}) {
  const kinds = [...new Set(tags.map((tag) => tag.kind))]

  if (tags.length === 0) return null

  return (
    <div className="space-y-4">
      {kinds.map((kind) => (
        <div key={kind}>
          <p className="text-content-subtle mb-2 text-xs tracking-wide uppercase">{titles[kind]}</p>

          <div className="flex flex-wrap gap-2">
            {tags
              .filter((tag) => tag.kind === kind)
              .map((tag) => {
                const active = selected.includes(tag.id)

                return (
                  <button
                    key={tag.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      onChange(
                        active ? selected.filter((id) => id !== tag.id) : [...selected, tag.id],
                      )
                    }
                    className={
                      active
                        ? 'border-accent bg-accent text-accent-content inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-medium'
                        : 'border-border text-content-muted hover:border-border-strong inline-flex min-h-9 items-center rounded-full border px-3 text-sm'
                    }
                  >
                    {tag.name}
                  </button>
                )
              })}
          </div>
        </div>
      ))}
    </div>
  )
}
