'use client'

import { X } from 'lucide-react'
import { useId, useState } from 'react'

import { Badge, Field, Input } from '@/ui'

/**
 * Список коротких значений: чему учит, на ком вырос, инструменты.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ НЕ ПОЛЕ «ЧЕРЕЗ ЗАПЯТУЮ»
 *
 * Строка «бой, перебор, соло» выглядит проще и работает ровно до
 * первого значения с запятой внутри. «Crosby, Stills & Nash»
 * превратились бы в три разных влияния, и починить это можно было бы
 * только вручную в базе.
 *
 * Поэтому значения добавляются по одному: Enter — добавить, крестик —
 * убрать. Дороже на десять строк кода, зато не ломается.
 * ─────────────────────────────────────────────────────────────────
 */

type TagListInputProps = {
  label: string
  hint?: string
  values: string[]
  onChange: (values: string[]) => void
}

export function TagListInput({ label, hint, values, onChange }: TagListInputProps) {
  const [draft, setDraft] = useState('')
  // Идентификатор нужен подписи поля: без связи «подпись — поле»
  // экранный диктор прочитает поле как безымянное
  const inputId = useId()

  function add(): void {
    const value = draft.trim()

    // Повтор молча игнорируется: человек добавил «бой» дважды,
    // сообщение об ошибке здесь было бы несоразмерным
    if (!value || values.includes(value)) {
      setDraft('')
      return
    }

    onChange([...values, value])
    setDraft('')
  }

  return (
    <Field label={label} htmlFor={inputId}>
      {values.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-2">
          {values.map((value) => (
            <li key={value}>
              <span className="border-border flex items-center gap-1 rounded-full border py-1 pr-1 pl-3 text-sm">
                {value}
                <button
                  type="button"
                  onClick={() => onChange(values.filter((item) => item !== value))}
                  aria-label={`Убрать: ${value}`}
                  className="text-content-subtle hover:text-danger flex size-7 items-center justify-center rounded-full"
                >
                  <X size={14} aria-hidden />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <Input
        id={inputId}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={add}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            add()
          }
        }}
        placeholder="Добавить и нажать Enter"
      />

      {hint ? <p className="text-content-subtle mt-1 text-xs">{hint}</p> : null}
    </Field>
  )
}

/** Показ без правки — для страниц, где список только читают */
export function TagList({ values }: { values: string[] }) {
  if (values.length === 0) return null

  return (
    <ul className="flex flex-wrap gap-2">
      {values.map((value) => (
        <li key={value}>
          <Badge variant="outline" size="sm">
            {value}
          </Badge>
        </li>
      ))}
    </ul>
  )
}
