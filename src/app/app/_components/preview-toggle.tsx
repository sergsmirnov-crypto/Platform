'use client'

import { usePathname } from 'next/navigation'

import { enterViewAsMember, exitViewAsMember } from '../_actions/preview'

/**
 * Кнопка включения или выключения режима «смотреть как участник».
 *
 * Одна кнопка на три места: меню профиля, полоса вверху экрана и заглушка
 * раздела «Управление». Внешний вид задаётся снаружи через `className`,
 * поведение остаётся общим — иначе кнопки со временем начнут работать
 * по-разному.
 *
 * Клиентский компонент нужен ради одной вещи: адрес текущей страницы.
 * Серверное действие не знает, откуда его позвали, а вернуть человека
 * надо туда же, где он был.
 */

type PreviewToggleProps = {
  mode: 'enter' | 'exit'
  className?: string
  children: React.ReactNode
}

export function PreviewToggle({ mode, className, children }: PreviewToggleProps) {
  const pathname = usePathname()
  const action = mode === 'enter' ? enterViewAsMember : exitViewAsMember

  return (
    <form action={action} className="contents">
      <input type="hidden" name="path" value={pathname} />
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  )
}
