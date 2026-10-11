'use client'

import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'

import { cn } from '@/ui/lib/cn'

/**
 * Переключатель темы.
 *
 * До первой отрисовки в браузере текущая тема неизвестна: на сервере
 * настроек человека нет. Поэтому подсветка активного варианта включается
 * только после того, как компонент оказался в браузере, — иначе разметка
 * сервера и браузера разошлись бы и React выдал бы предупреждение.
 */
const emptySubscribe = () => () => {}

/** true в браузере, false при отрисовке на сервере */
function useIsClient(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
}
const OPTIONS = [
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
  { value: 'system', label: 'Как в системе' },
] as const

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const isClient = useIsClient()

  return (
    <div
      className={cn('border-border inline-flex gap-1 rounded-full border p-1', className)}
      role="group"
      aria-label="Оформление"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setTheme(option.value)}
          aria-pressed={isClient ? theme === option.value : undefined}
          className={cn(
            'rounded-full px-3 py-1.5 text-sm transition-colors',
            isClient && theme === option.value
              ? 'bg-accent text-accent-content font-medium'
              : 'text-content-muted hover:bg-surface-hover',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
