'use client'

import { X } from 'lucide-react'
import { useState } from 'react'

import { Input } from '@/ui/primitives/input'

/**
 * Ввод списка значений: любимые исполнители, теги, что угодно.
 *
 * Добавление по Enter и по запятой. Запятая нужна обязательно: человек,
 * переносящий список из заметок, вставит его целиком через запятую —
 * и без разбора получит одного «исполнителя» из двенадцати имён.
 *
 * Удаление — крестиком и клавишей Backspace в пустом поле. Второе привычно
 * тем, кто работает с клавиатуры, и ничего не стоит.
 */

type ChipsInputProps = {
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string | undefined
  max?: number | undefined
  id?: string | undefined
  disabled?: boolean | undefined
}

export function ChipsInput({ values, onChange, placeholder, max, id, disabled }: ChipsInputProps) {
  const [draft, setDraft] = useState('')

  const isFull = max !== undefined && values.length >= max

  function commit(raw: string) {
    const parts = raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)

    if (parts.length === 0) return

    const next = [...values]

    for (const part of parts) {
      if (max !== undefined && next.length >= max) break
      if (next.some((value) => value.toLowerCase() === part.toLowerCase())) continue
      next.push(part)
    }

    onChange(next)
    setDraft('')
  }

  return (
    <div>
      {values.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-2">
          {values.map((value) => (
            <li
              key={value}
              className="bg-surface-hover text-content flex items-center gap-1 rounded-full py-1 pr-1 pl-3 text-sm"
            >
              {value}
              <button
                type="button"
                onClick={() => onChange(values.filter((item) => item !== value))}
                aria-label={`Убрать ${value}`}
                disabled={disabled}
                className="hover:bg-surface flex h-6 w-6 items-center justify-center rounded-full"
              >
                <X size={13} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Input
        id={id}
        value={draft}
        disabled={disabled || isFull}
        placeholder={isFull ? 'Больше не поместится' : placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault()
            commit(draft)
            return
          }

          if (event.key === 'Backspace' && draft === '' && values.length > 0) {
            onChange(values.slice(0, -1))
          }
        }}
      />
    </div>
  )
}
