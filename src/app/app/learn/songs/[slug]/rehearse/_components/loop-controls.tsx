'use client'

import { Repeat, X } from 'lucide-react'

import type { LoopRange } from '@/shared/playback'
import { formatTimecode } from '@/shared/utils/timecode'

/**
 * A–B зацикливание.
 *
 * ─────────────────────────────────────────────────────────────────
 * ДВЕ ОТМЕТКИ ОДНОЙ КНОПКОЙ, А НЕ ДВУМЯ ПОЛЯМИ
 *
 * Отрезок ставят во время игры: доиграл до начала трудного места —
 * нажал, доиграл до конца — нажал ещё раз. Одна кнопка, меняющая
 * подпись, требует одного взгляда на экран.
 *
 * Два поля с временем потребовали бы остановиться, посмотреть на плеер,
 * переписать секунды и вернуться к гитаре. Ради этого режим репетиции
 * и затевался — чтобы этого не делать.
 * ─────────────────────────────────────────────────────────────────
 *
 * Порядок отметок не важен: поставить конец раньше начала — не ошибка,
 * а способ отметить кусок, который только что проиграл.
 */

type LoopControlsProps = {
  /** Первая поставленная отметка, пока вторая не поставлена */
  pending: number | null
  loop: LoopRange | null
  onMark: () => void
  onClear: () => void
}

export function LoopControls({ pending, loop, onMark, onClear }: LoopControlsProps) {
  const label = loop ? 'Отрезок задан' : pending === null ? 'Отметить начало' : 'Отметить конец'

  return (
    <div className="border-border rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-content-subtle text-xs tracking-wide uppercase">Повтор отрезка</span>

        {loop ? (
          <button
            type="button"
            onClick={onClear}
            className="text-content-muted hover:text-content inline-flex h-9 items-center gap-1.5 text-sm"
          >
            <X size={16} aria-hidden />
            Убрать
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={loop ? onClear : onMark}
        className={
          loop
            ? 'border-accent bg-accent text-accent-content flex h-14 w-full items-center justify-center gap-2 rounded-xl border font-medium'
            : 'border-border hover:border-border-strong flex h-14 w-full items-center justify-center gap-2 rounded-xl border font-medium'
        }
      >
        <Repeat size={20} aria-hidden />
        {label}
      </button>

      <p className="text-content-muted mt-2 text-center text-sm tabular-nums">
        {loop ? (
          <>
            {formatTimecode(loop.from)} — {formatTimecode(loop.to)}
          </>
        ) : pending === null ? (
          'Доиграйте до трудного места и нажмите'
        ) : (
          <>Начало: {formatTimecode(pending)}</>
        )}
      </p>
    </div>
  )
}
