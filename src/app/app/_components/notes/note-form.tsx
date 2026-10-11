'use client'

import { Clock, X } from 'lucide-react'
import { useState } from 'react'

import { libraryStrings } from '@/modules/library'
import { formatTimecode } from '@/shared/utils/timecode'
import { Button, Textarea } from '@/ui'

import { usePlayback } from '../playback-context'

/**
 * Форма заметки — общая для создания и правки.
 *
 * ─────────────────────────────────────────────────────────────────
 * ВРЕМЯ ПОДСТАВЛЯЕТСЯ, А НЕ ВВОДИТСЯ
 *
 * Куратор в редакторе печатает таймкоды руками — он размечает запись
 * заранее и по списку. Участник же пишет заметку в момент, когда
 * споткнулся: у него в руках гитара, а на экране идёт видео. Просить
 * его переписать «2:14» из плеера в поле — значит не получить ни одной
 * заметки.
 *
 * Поэтому здесь одна кнопка «Отметить текущее место», и она берёт время
 * прямо у плеера. Ввод времени руками не предусмотрен вовсе: случай,
 * когда человек знает секунду, но не может доиграть до неё, выдуманный.
 * ─────────────────────────────────────────────────────────────────
 *
 * Кнопка появляется, только когда плеер рядом есть и запись уже начали
 * проигрывать. Без видео форма остаётся обычным полем для пометки.
 */

type NoteFormProps = {
  initialBody?: string
  initialTimecode?: number | null
  submitLabel: string
  pending: boolean
  error?: string | null
  onSubmit: (body: string, timecodeSec: number | null) => void
  onCancel?: (() => void) | undefined
}

export function NoteForm({
  initialBody = '',
  initialTimecode = null,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: NoteFormProps) {
  const [body, setBody] = useState(initialBody)
  const [timecode, setTimecode] = useState<number | null>(initialTimecode)

  const playback = usePlayback()

  function captureTime(): void {
    const current = playback?.()?.getCurrentTime() ?? null
    if (current === null) return

    setTimecode(Math.round(current))
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={libraryStrings.notes.placeholder}
        rows={3}
        aria-label={libraryStrings.notes.add}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => onSubmit(body, timecode)}
          // Пустую заметку не отправляем даже на проверку: сервер ответит
          // тем же, но человек успеет увидеть мигание ошибки
          disabled={pending || body.trim().length === 0}
          size="sm"
        >
          {submitLabel}
        </Button>

        {onCancel ? (
          <Button onClick={onCancel} disabled={pending} variant="ghost" size="sm">
            {libraryStrings.notes.cancel}
          </Button>
        ) : null}

        <span className="flex-1" />

        {timecode === null ? (
          playback ? (
            <Button onClick={captureTime} variant="ghost" size="sm" disabled={pending}>
              <Clock size={16} aria-hidden />
              {libraryStrings.notes.captureTime}
            </Button>
          ) : null
        ) : (
          <span className="border-border text-content-muted inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm">
            <Clock size={14} aria-hidden />
            <span className="tabular-nums">{formatTimecode(timecode)}</span>
            <button
              type="button"
              onClick={() => setTimecode(null)}
              disabled={pending}
              className="hover:text-content"
              aria-label={libraryStrings.notes.clearTime}
            >
              <X size={14} aria-hidden />
            </button>
          </span>
        )}
      </div>

      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
    </div>
  )
}
