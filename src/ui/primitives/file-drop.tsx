'use client'

import { Upload } from 'lucide-react'
import { useRef, useState } from 'react'

import { cn } from '@/ui/lib/cn'

/**
 * Зона выбора файла.
 *
 * Только внешний вид: сама ничего не отправляет и о хранилище не знает.
 * Отправку делает тот, кто её поставил, — так один и тот же компонент
 * годится и для табов разбора, и для конспекта урока, и для вложения
 * к эфиру.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПЕРЕТАСКИВАНИЕ ЕСТЬ, НО ОНО НЕ ЕДИНСТВЕННЫЙ СПОСОБ
 *
 * Перетащить файл — удобно за столом и невозможно с телефона. Поэтому
 * вся зона одновременно является кнопкой: нажатие открывает обычный
 * выбор файла, и это работает везде, включая клавиатуру и экранный
 * диктор.
 * ─────────────────────────────────────────────────────────────────
 */

type FileDropProps = {
  /** Значение для поля выбора: '.pdf,.gp5,…' */
  accept: string
  label: string
  hint?: string
  /** Идёт ли отправка прямо сейчас */
  busy?: boolean
  /** Доля отправленного, 0–100. `null` — прогресс неизвестен */
  progress?: number | null
  busyLabel?: string
  disabled?: boolean
  error?: string | null
  onFile: (file: File) => void
}

export function FileDrop({
  accept,
  label,
  hint,
  busy = false,
  progress = null,
  busyLabel = 'Загружаю',
  disabled = false,
  error = null,
  onFile,
}: FileDropProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const blocked = busy || disabled

  function handleFiles(files: FileList | null): void {
    const file = files?.[0]
    if (file) onFile(file)
  }

  return (
    <div>
      <button
        type="button"
        disabled={blocked}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          if (blocked) return
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          if (blocked) return
          event.preventDefault()
          setDragging(false)
          handleFiles(event.dataTransfer.files)
        }}
        className={cn(
          'border-border flex w-full flex-col items-center justify-center gap-1.5',
          'min-h-28 rounded-xl border border-dashed px-4 py-6 text-center transition-colors',
          'focus:border-border-strong focus:outline-none',
          dragging ? 'border-accent bg-accent-soft' : 'hover:bg-surface-hover',
          blocked && 'cursor-default opacity-60 hover:bg-transparent',
        )}
      >
        <Upload size={20} className="text-content-subtle" aria-hidden />

        <span className="text-sm font-medium">{busy ? `${busyLabel}…` : label}</span>

        {hint && !busy ? <span className="text-content-muted text-xs">{hint}</span> : null}

        {busy ? (
          <span
            className="bg-surface-hover mt-2 h-1.5 w-full max-w-56 overflow-hidden rounded-full"
            role="progressbar"
            aria-valuenow={progress ?? undefined}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span
              className="bg-accent block h-full transition-[width] duration-200"
              style={{ width: `${progress ?? 10}%` }}
            />
          </span>
        ) : null}
      </button>

      {/*
        Поле выбора скрыто, а нажимается зона выше: внешний вид этого поля
        браузер менять не даёт, и во всех браузерах он свой. Значение
        сбрасывается сразу — иначе повторный выбор того же файла не вызовет
        события, и человек решит, что кнопка сломалась
      */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const files = event.target.files
          event.target.value = ''
          handleFiles(files)
        }}
      />

      {error ? (
        <p role="alert" className="text-danger mt-2 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  )
}
