'use client'

import { Eye, LogOut, Settings2, User } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { signOutAndRedirect } from '@/modules/identity/actions'
import { routes } from '@/shared/routes'
import { Avatar, cn } from '@/ui'
import { ThemeToggle } from '@/ui/theme/theme-toggle'

import { PreviewToggle } from './preview-toggle'

/**
 * Меню профиля в шапке.
 *
 * Собирает всё, что относится к самому человеку: кто он, оформление,
 * переход в личный кабинет, режим просмотра и выход. До этого шага выход
 * висел в шапке голой кнопкой, а переключатель темы был доступен только
 * на компьютере — на телефоне сменить оформление было нельзя вовсе,
 * хотя вечерние занятия с телефона это основной сценарий.
 *
 * Своё меню, а не готовая библиотека: одно выпадающее меню на весь проект
 * не стоит нового пакета в зависимостях. Если таких мест станет несколько,
 * решение переедет в дизайн-систему целиком.
 *
 * Аватар берётся из профиля. Пока фотография не загружена — нейтральный
 * силуэт: фото из Telegram по решению владельца платформы не подставляется.
 */

type ProfileMenuProps = {
  displayName: string
  avatarUrl: string | null
  /** Есть ли управляющие права на самом деле, независимо от режима */
  canManage: boolean
  isPreview: boolean
}

const ITEM_CLASS =
  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-content hover:bg-surface-hover'

export function ProfileMenu({ displayName, avatarUrl, canManage, isPreview }: ProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Меню закрывается по нажатию мимо него и по Escape. Без этого оно
  // остаётся висеть поверх страницы, и человек не понимает, как его убрать.
  useEffect(() => {
    if (!isOpen) return

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Меню профиля"
        className={cn(
          'flex h-11 w-11 items-center justify-center rounded-full text-sm font-medium transition-colors',
          isOpen ? 'bg-surface-hover' : 'hover:bg-surface-hover',
        )}
      >
        <Avatar src={avatarUrl} alt={displayName} size="sm" />
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="border-border bg-surface-raised absolute right-0 z-50 mt-2 w-64 rounded-xl border p-2 shadow-lg"
        >
          <p className="text-content px-3 pt-1 pb-2 text-sm font-medium">{displayName}</p>

          <Link
            href={routes.app.me.profile()}
            className={ITEM_CLASS}
            onClick={() => setIsOpen(false)}
          >
            <User size={16} aria-hidden />
            Профиль
          </Link>

          <Link
            href={routes.app.me.settings()}
            className={ITEM_CLASS}
            onClick={() => setIsOpen(false)}
          >
            <Settings2 size={16} aria-hidden />
            Настройки
          </Link>

          {canManage ? (
            <div className="border-border mt-2 border-t pt-2">
              {isPreview ? (
                <PreviewToggle mode="exit" className={ITEM_CLASS}>
                  <Eye size={16} aria-hidden />
                  Вернуться к управлению
                </PreviewToggle>
              ) : (
                <PreviewToggle mode="enter" className={ITEM_CLASS}>
                  <Eye size={16} aria-hidden />
                  Смотреть как участник
                </PreviewToggle>
              )}
            </div>
          ) : null}

          <div className="border-border mt-2 border-t pt-3 pb-1">
            <p className="text-content-subtle px-3 pb-2 text-xs tracking-wide uppercase">
              Оформление
            </p>
            <ThemeToggle className="mx-2 flex" />
          </div>

          <div className="border-border mt-2 border-t pt-2">
            <form action={signOutAndRedirect} className="contents">
              <button type="submit" className={ITEM_CLASS}>
                <LogOut size={16} aria-hidden />
                Выйти
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
