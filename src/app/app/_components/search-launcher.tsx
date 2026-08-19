'use client'

import { Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { routes } from '@/shared/routes'

/**
 * Кнопка поиска в шапке и сочетание клавиш.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПЕРЕХОД НА СТРАНИЦУ, А НЕ ВСПЛЫВАЮЩЕЕ ОКНО
 *
 * ⌘K обычно открывает оверлей с мгновенными результатами. Здесь —
 * переход на страницу поиска, и это осознанно.
 *
 * Оверлей означает поиск на лету: четыре запроса к базе на каждую
 * букву, собственная разметка результатов, ловушки с фокусом
 * и доступностью, отдельная логика для телефона, где всплывающее окно
 * во весь экран — это и есть страница. Всё это ради того, чтобы
 * сэкономить один переход.
 *
 * Отдельная страница даёт то, чего оверлей не даёт вовсе: результаты
 * можно открыть в новой вкладке, отправить ссылкой и вернуться к ним
 * кнопкой «назад».
 *
 * Если поиском начнут пользоваться по многу раз за сессию, оверлей
 * будет чем дополнить — страница при этом остаётся.
 * ─────────────────────────────────────────────────────────────────
 */
export function SearchLauncher() {
  const router = useRouter()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'k' || !(event.metaKey || event.ctrlKey)) return

      // Отменяем стандартное действие браузера: в Chrome ⌘K — это
      // переход в адресную строку
      event.preventDefault()
      router.push(routes.app.search())
    }

    globalThis.addEventListener('keydown', onKeyDown)

    return () => globalThis.removeEventListener('keydown', onKeyDown)
  }, [router])

  return (
    <button
      type="button"
      onClick={() => router.push(routes.app.search())}
      aria-label="Поиск"
      title="Поиск (⌘K)"
      className="text-content-muted hover:text-content flex h-11 w-11 items-center justify-center"
    >
      <Search size={20} aria-hidden />
    </button>
  )
}
