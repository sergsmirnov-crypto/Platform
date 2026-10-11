'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/ui'

import { isNavItemActive, MAIN_NAV } from '../_lib/navigation'

/**
 * Нижняя панель на телефоне.
 *
 * Пять пунктов — предел, при котором в кнопку можно уверенно попасть
 * пальцем. Отсюда и вся структура навигации: не «семь разделов не влезли
 * в дизайн», а «больше пяти нельзя, значит разделов пять».
 *
 * Высота кнопки не меньше 44 пикселей — требование к тап-таргетам
 * из PRD v0.1 §10. Человек нажимает это с гитарой в руках.
 *
 * Панель закреплена внизу и учитывает безопасную зону: на телефонах
 * без кнопки «домой» иначе последний ряд уезжает под системную полосу.
 */
export function TabBar() {
  const pathname = usePathname()

  return (
    <nav
      className="border-border bg-surface fixed inset-x-0 bottom-0 z-40 border-t md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Разделы платформы"
    >
      <ul className="flex">
        {MAIN_NAV.map((item) => {
          const active = isNavItemActive(item.href, pathname)
          const Icon = item.icon

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px]',
                  active ? 'text-content font-medium' : 'text-content-muted',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-12 items-center justify-center rounded-full transition-colors',
                    active ? 'bg-accent text-accent-content' : '',
                  )}
                >
                  <Icon size={18} aria-hidden />
                </span>
                {item.shortLabel}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
