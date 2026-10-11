'use client'

import { Clock, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'

import { libraryStrings, sortNotes } from '@/modules/library'
import type { Note, NoteEntity } from '@/modules/library'
import { formatTimecode } from '@/shared/utils/timecode'
import { Button } from '@/ui'

import { createNoteAction, editNoteAction, removeNoteAction } from '../../_actions/notes'
import { usePlayback } from '../playback-context'

import { NoteForm } from './note-form'

/**
 * Заметки к открытой записи.
 *
 * ─────────────────────────────────────────────────────────────────
 * СПИСОК ЖИВЁТ В СОСТОЯНИИ, А НЕ ОБНОВЛЯЕТСЯ СТРАНИЦЕЙ
 *
 * Соблазн был: сохранить и вызвать обновление страницы, как делает
 * кнопка «Отложить» на странице отложенного. Здесь так нельзя.
 *
 * Заметку пишут во время просмотра. Обновление страницы пересоздаёт
 * плеер: видео начинается заново, буфер теряется, место просмотра
 * сбрасывается. Человек, записавший «здесь застреваю», в награду
 * получил бы прерванный разбор — и больше заметок не писал бы.
 *
 * Поэтому список меняется на месте, а сервер только подтверждает.
 * Не получилось — возвращаем как было и говорим об этом.
 * ─────────────────────────────────────────────────────────────────
 *
 * Время у заметки кликабельно: нажатие перематывает уже загруженный
 * ролик. Ради этого связь с плеером и заводилась.
 */

type NotesPanelProps = {
  entityType: NoteEntity
  entityId: string
  initialNotes: Note[]
}

export function NotesPanel({ entityType, entityId, initialNotes }: NotesPanelProps) {
  const [notes, setNotes] = useState(initialNotes)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const playback = usePlayback()

  function jumpTo(seconds: number): void {
    playback?.()?.seekTo(seconds)
  }

  function add(body: string, timecodeSec: number | null): void {
    setError(null)

    startTransition(async () => {
      const result = await createNoteAction({ entityType, entityId, body, timecodeSec })

      if (!result.ok) {
        setError(result.message || libraryStrings.notes.errors.failed)
        return
      }

      setNotes((current) => sortNotes([...current, result.data]))
      setAdding(false)
    })
  }

  function edit(noteId: string, body: string, timecodeSec: number | null): void {
    setError(null)

    startTransition(async () => {
      const result = await editNoteAction({ noteId, body, timecodeSec })

      if (!result.ok) {
        setError(result.message || libraryStrings.notes.errors.failed)
        return
      }

      setNotes((current) =>
        sortNotes(current.map((note) => (note.id === noteId ? result.data : note))),
      )
      setEditingId(null)
    })
  }

  function remove(noteId: string): void {
    // Подтверждение спрашиваем: заметку писали руками, и восстановить
    // её неоткуда — отмены у нас нет
    if (!globalThis.confirm(libraryStrings.notes.confirmRemove)) return

    setError(null)
    const previous = notes
    setNotes((current) => current.filter((note) => note.id !== noteId))

    startTransition(async () => {
      const result = await removeNoteAction({ noteId })

      if (!result.ok) {
        setNotes(previous)
        setError(result.message || libraryStrings.notes.errors.failed)
      }
    })
  }

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="font-display text-xl font-bold">{libraryStrings.notes.heading}</h2>
        <span className="text-content-muted text-sm">{libraryStrings.notes.hint}</span>
      </div>

      {notes.length > 0 ? (
        <ul className="mb-4 space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="border-border rounded-xl border p-4">
              {editingId === note.id ? (
                <NoteForm
                  initialBody={note.body}
                  initialTimecode={note.timecodeSec}
                  submitLabel={libraryStrings.notes.save}
                  pending={pending}
                  error={error}
                  onSubmit={(body, timecodeSec) => edit(note.id, body, timecodeSec)}
                  onCancel={() => {
                    setEditingId(null)
                    setError(null)
                  }}
                />
              ) : (
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    {note.timecodeSec !== null ? (
                      <TimecodeMark
                        seconds={note.timecodeSec}
                        onJump={playback ? () => jumpTo(note.timecodeSec ?? 0) : null}
                      />
                    ) : null}

                    {/* Переносы строк сохраняем: заметку пишут списком
                        подходов, и в одну строку она нечитаема */}
                    <p className="mt-1 whitespace-pre-wrap">{note.body}</p>
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <Button
                      onClick={() => {
                        setEditingId(note.id)
                        setError(null)
                      }}
                      variant="ghost"
                      size="sm"
                      className="px-3"
                      aria-label={libraryStrings.notes.edit}
                      disabled={pending}
                    >
                      <Pencil size={16} aria-hidden />
                    </Button>

                    <Button
                      onClick={() => remove(note.id)}
                      variant="ghost"
                      size="sm"
                      className="px-3"
                      aria-label={libraryStrings.notes.remove}
                      disabled={pending}
                    >
                      <Trash2 size={16} aria-hidden />
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-content-muted mb-4 text-sm">
          {libraryStrings.notes.empty}
          <span className="block">{libraryStrings.notes.emptyHint}</span>
        </p>
      )}

      {adding ? (
        <div className="border-border rounded-xl border p-4">
          <NoteForm
            submitLabel={libraryStrings.notes.save}
            pending={pending}
            error={error}
            onSubmit={add}
            onCancel={() => {
              setAdding(false)
              setError(null)
            }}
          />
        </div>
      ) : (
        <Button onClick={() => setAdding(true)} variant="secondary" size="sm">
          <Plus size={16} aria-hidden />
          {libraryStrings.notes.add}
        </Button>
      )}

      {/* Ошибка удаления показывается здесь: формы в этот момент нет */}
      {error && !adding && editingId === null ? (
        <p role="alert" className="text-danger mt-2 text-sm">
          {error}
        </p>
      ) : null}
    </section>
  )
}

/**
 * Время заметки.
 *
 * Кнопка, когда плеер рядом, и обычная надпись, когда его нет: разбор
 * могли открыть без подписки или без записи, и нажатие тогда ничего
 * не сделает. Неработающая кнопка хуже надписи.
 */
function TimecodeMark({ seconds, onJump }: { seconds: number; onJump: (() => void) | null }) {
  const label = formatTimecode(seconds)

  if (!onJump) {
    return (
      <span className="text-content-muted inline-flex items-center gap-1.5 text-sm tabular-nums">
        <Clock size={14} aria-hidden />
        {label}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onJump}
      className="text-content hover:text-content-muted inline-flex items-center gap-1.5 text-sm font-medium tabular-nums underline decoration-dotted underline-offset-4"
      title={libraryStrings.notes.atTime(label)}
    >
      <Clock size={14} aria-hidden />
      {label}
    </button>
  )
}
