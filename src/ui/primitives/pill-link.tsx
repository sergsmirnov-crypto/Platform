import Link from 'next/link'

import { cn } from '@/ui/lib/cn'

import type { ComponentProps } from 'react'

/**
 * Ссылка-таблетка: фильтр, подборка, переключатель уровня, номер страницы.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ССЫЛКА, А НЕ КНОПКА С ОБРАБОТЧИКОМ
 *
 * Всё, что переключается этим элементом, живёт в адресной строке.
 * Из этого бесплатно получается работающая кнопка «назад», возможность
 * отправить товарищу ссылку на «продвинутый разбор Nothing Else Matters»,
 * отрисовка сразу на сервере и работа при выключенном JavaScript.
 *
 * Расплата — переход страницы на нажатие. При серверной сборке
 * это незаметно.
 * ─────────────────────────────────────────────────────────────────
 *
 * Три состояния вместо двух. `active` — выбранное значение фильтра,
 * жёлтая заливка. `current` — то, что человек смотрит прямо сейчас
 * (открытый уровень, текущая страница); подсветка сдержаннее, потому
 * что это не выбор, а положение. Путать их нельзя: жёлтым на экране
 * должно гореть то, что человек включил сам.
 */

type PillLinkProps = ComponentProps<typeof Link> & {
  /** Значение выбрано человеком: фильтр, подборка */
  active?: boolean
  /** Человек находится здесь: открытый уровень, текущая страница */
  current?: boolean
  size?: 'sm' | 'md'
}

export function PillLink({
  active = false,
  current = false,
  size = 'sm',
  className,
  ...props
}: PillLinkProps) {
  return (
    <Link
      // `aria-pressed` для выбора, `aria-current` для положения:
      // экранный диктор объявляет их по-разному, и это верно
      aria-pressed={active ? true : undefined}
      aria-current={current ? 'true' : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border whitespace-nowrap transition-colors',
        size === 'sm' ? 'min-h-9 px-3 text-sm' : 'min-h-11 px-5 text-sm',
        active && 'border-accent bg-accent text-accent-content font-medium',
        current && !active && 'border-border-strong bg-surface-hover text-content font-medium',
        !active && !current && 'border-border text-content-muted hover:border-border-strong',
        className,
      )}
      {...props}
    />
  )
}
