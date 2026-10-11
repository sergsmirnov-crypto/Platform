'use client'

import { cn } from '@/ui/lib/cn'

/**
 * Выбор нескольких значений из готового списка: жанры, техники, строй.
 *
 * Кнопки, а не выпадающий список с множественным выбором. На телефоне
 * такой список — одно из самых неудобных, что бывает в вебе: он закрывает
 * экран, требует прицельного попадания и не показывает выбранное целиком.
 * Тринадцать кнопок видны сразу и нажимаются пальцем.
 */

type ToggleGroupProps = {
  options: readonly string[]
  values: string[]
  onChange: (values: string[]) => void
  disabled?: boolean | undefined
}

export function ToggleGroup({ options, values, onChange, disabled }: ToggleGroupProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = values.includes(option)

        return (
          <button
            key={option}
            type="button"
            aria-pressed={isSelected}
            disabled={disabled}
            onClick={() =>
              onChange(
                isSelected ? values.filter((value) => value !== option) : [...values, option],
              )
            }
            className={cn(
              'min-h-11 rounded-full border px-4 text-sm transition-colors disabled:opacity-50',
              isSelected
                ? 'border-accent bg-accent text-accent-content'
                : 'border-border text-content-muted hover:border-border-strong',
            )}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}
