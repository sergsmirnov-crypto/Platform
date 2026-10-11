'use client'

import { useState, useTransition } from 'react'

import { formatTimecode, parseTimecode } from '@/modules/songs'
import { Button, Input } from '@/ui'

import {
  deleteSectionAction,
  reorderSectionsAction,
  saveSectionAction,
} from '../../_actions/song-editor'

/**
 * Части разбора.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ КНОПКИ «ВЫШЕ / НИЖЕ», А НЕ ПЕРЕТАСКИВАНИЕ
 *
 * В первом наброске было перетаскивание мышью (PRD v0.1 §8.2). Отказался,
 * и вот почему.
 *
 * Перетаскивание требует библиотеки, ломается на сенсорных экранах внутри
 * прокручиваемой страницы — палец одновременно тянет элемент и скроллит, —
 * и недоступно с клавиатуры без отдельной реализации. Кураторов трое,
 * частей в разборе шесть, и переставляют их редко: выигрыш от красивого
 * жеста здесь меньше, чем цена его починки на телефоне.
 *
 * Кнопки работают везде одинаково, читаются экранным диктором и не требуют
 * ни одной строки чужого кода. Если перетаскивание однажды понадобится,
 * оно добавится сюда, не задев ни сервер, ни остальную страницу.
 * ─────────────────────────────────────────────────────────────────
 *
 * Таймкоды вводятся как «2:14» — так они выглядят в плеере, откуда куратор
 * их и переписывает. Превращение в секунды делает форма: заставлять
 * человека считать 134 значит получать ошибки на каждом десятом разборе.
 */

type Section = {
  id: string
  title: string
  description: string | null
  orderIndex: number
  videoStartSec: number | null
  videoEndSec: number | null
}

type SectionEditorProps = {
  arrangementId: string
  sections: Section[]
  onChanged: () => void
}

export function SectionEditor({ arrangementId, sections, onChanged }: SectionEditorProps) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function move(index: number, direction: -1 | 1) {
    const next = [...sections]
    const target = index + direction
    if (target < 0 || target >= next.length) return

    const moved = next[index]
    const replaced = next[target]
    if (!moved || !replaced) return

    next[index] = replaced
    next[target] = moved

    startTransition(async () => {
      const result = await reorderSectionsAction({
        arrangementId,
        sectionIds: next.map((section) => section.id),
      })

      if (!result.ok) setError(result.message)
      else onChanged()
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Части разбора</h3>
        <span className="text-content-muted text-sm">{sections.length}</span>
      </div>

      {sections.length === 0 ? (
        <p className="text-content-muted text-sm">
          Частей пока нет. Добавьте первую — например, «Вступление».
        </p>
      ) : (
        <ol className="space-y-2">
          {sections.map((section, index) => (
            <li key={section.id}>
              <SectionRow
                arrangementId={arrangementId}
                section={section}
                index={index}
                isFirst={index === 0}
                isLast={index === sections.length - 1}
                busy={pending}
                onMove={move}
                onChanged={onChanged}
              />
            </li>
          ))}
        </ol>
      )}

      {error ? <p className="text-danger text-sm">{error}</p> : null}

      <NewSection arrangementId={arrangementId} order={sections.length} onChanged={onChanged} />
    </div>
  )
}

function SectionRow({
  arrangementId,
  section,
  index,
  isFirst,
  isLast,
  busy,
  onMove,
  onChanged,
}: {
  arrangementId: string
  section: Section
  index: number
  isFirst: boolean
  isLast: boolean
  busy: boolean
  onMove: (index: number, direction: -1 | 1) => void
  onChanged: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [title, setTitle] = useState(section.title)
  const [start, setStart] = useState(formatTimecode(section.videoStartSec))
  const [end, setEnd] = useState(formatTimecode(section.videoEndSec))

  function save() {
    setErrors({})
    startTransition(async () => {
      const result = await saveSectionAction({
        arrangementId,
        orderIndex: index,
        values: {
          id: section.id,
          title,
          description: section.description ?? '',
          videoStartSec: parseTimecode(start),
          videoEndSec: parseTimecode(end),
        },
      })

      if (!result.ok) setErrors(result.fields ?? { form: result.message })
      else onChanged()
    })
  }

  return (
    <div className="border-border flex flex-wrap items-end gap-3 rounded-lg border p-3">
      <div className="flex shrink-0 flex-col gap-1">
        <button
          type="button"
          onClick={() => onMove(index, -1)}
          disabled={isFirst || busy}
          aria-label="Переместить выше"
          className="border-border text-content-muted hover:border-border-strong h-6 w-8 rounded border text-xs disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMove(index, 1)}
          disabled={isLast || busy}
          aria-label="Переместить ниже"
          className="border-border text-content-muted hover:border-border-strong h-6 w-8 rounded border text-xs disabled:opacity-30"
        >
          ↓
        </button>
      </div>

      <div className="min-w-40 flex-1">
        <label className="text-content-subtle mb-1 block text-xs" htmlFor={`t-${section.id}`}>
          Название
        </label>
        <Input
          id={`t-${section.id}`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={save}
          aria-invalid={Boolean(errors.title)}
        />
      </div>

      <div className="w-24">
        <label className="text-content-subtle mb-1 block text-xs" htmlFor={`s-${section.id}`}>
          Начало
        </label>
        <Input
          id={`s-${section.id}`}
          value={start}
          placeholder="2:14"
          onChange={(event) => setStart(event.target.value)}
          onBlur={save}
        />
      </div>

      <div className="w-24">
        <label className="text-content-subtle mb-1 block text-xs" htmlFor={`e-${section.id}`}>
          Конец
        </label>
        <Input
          id={`e-${section.id}`}
          value={end}
          placeholder="5:19"
          onChange={(event) => setEnd(event.target.value)}
          onBlur={save}
          aria-invalid={Boolean(errors.videoEndSec)}
        />
      </div>

      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (confirm(`Удалить часть «${section.title}»?`)) {
            startTransition(async () => {
              await deleteSectionAction({ arrangementId, sectionId: section.id })
              onChanged()
            })
          }
        }}
      >
        Удалить
      </Button>

      {errors.videoEndSec ? (
        <p className="text-danger w-full text-sm">{errors.videoEndSec}</p>
      ) : null}
      {errors.title ? <p className="text-danger w-full text-sm">{errors.title}</p> : null}
    </div>
  )
}

function NewSection({
  arrangementId,
  order,
  onChanged,
}: {
  arrangementId: string
  order: number
  onChanged: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [title, setTitle] = useState('')

  function add() {
    if (!title.trim()) return

    startTransition(async () => {
      await saveSectionAction({
        arrangementId,
        orderIndex: order,
        values: { title, description: '', videoStartSec: '', videoEndSec: '' },
      })
      setTitle('')
      onChanged()
    })
  }

  return (
    <div className="flex items-center gap-3">
      <Input
        value={title}
        placeholder="Новая часть: например, «Соло»"
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          // Enter добавляет часть, не отправляя ничего лишнего: куратор
          // вводит шесть названий подряд и не тянется к мыши между ними
          if (event.key === 'Enter') {
            event.preventDefault()
            add()
          }
        }}
      />
      <Button variant="secondary" onClick={add} disabled={pending || !title.trim()}>
        Добавить
      </Button>
    </div>
  )
}
