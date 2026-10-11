'use client'

import { Settings } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/ui'

import { isNavItemActive, MAIN_NAV } from '../_lib/navigation'

import type { NavChild } from '../_lib/navigation'

/**
 * Боковое меню на компьютере.
 *
 * Подразделы раскрываются у активного пункта, а не по нажатию: человек
 * и так внутри раздела, лишний клик ради того, чтобы увидеть его состав,
 * не нужен. Свёрнутые пункты остаются одной строкой — меню не превращается
 * в простыню из шестнадцати ссылок.
 *
 * Клиентский компонент, потому что подсветка активного пункта зависит
 * от текущего адреса.
 */

type SidebarProps = {
  /** Пункты управления, уже отфильтрованные по правам на сервере */
  manageItems: NavChild[]
}

export function Sidebar({ manageItems }: SidebarProps) {
  const pathname = usePathname()

  return (
    <nav
      className={cn(
        'border-border bg-surface hidden w-60 shrink-0 flex-col border-r px-3 py-6 md:flex',
        // Меню прилипает под шапкой и прокручивается отдельно от страницы:
        // у владельца в разделе управления тринадцать пунктов, и на ноутбуке
        // они не помещаются в экран целиком.
        // 3.5rem — высота шапки, `--banner-h` — полоса режима просмотра
        // (ноль, когда режим выключен)
        'sticky top-[calc(3.5rem+var(--banner-h))] max-h-[calc(100dvh-3.5rem-var(--banner-h))] overflow-y-auto',
      )}
      aria-label="Разделы платформы"
    >
      <ul className="flex flex-col gap-1">
        {MAIN_NAV.map((item) => {
          const active = isNavItemActive(item.href, pathname)
          const Icon = item.icon

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-accent text-accent-content font-medium'
                    : 'text-content hover:bg-surface-hover',
                )}
              >
                <Icon size={18} aria-hidden />
                {item.label}
              </Link>

              {active && item.children ? (
                <ul className="border-border mt-1 ml-6 flex flex-col gap-0.5 border-l pl-3">
                  {item.children.map((child) => (
                    <li key={child.href}>
                      <Link
                        href={child.href}
                        className={cn(
                          'block rounded-lg px-2 py-1.5 text-sm transition-colors',
                          pathname === child.href
                            ? 'text-content font-medium'
                            : 'text-content-muted hover:text-content',
                        )}
                      >
                        {child.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>

      {manageItems.length > 0 ? (
        <div className="border-border mt-6 border-t pt-4">
          <p className="text-content-subtle px-3 pb-1 text-xs tracking-wide uppercase">
            Управление
          </p>
          <ul className="flex flex-col gap-0.5">
            {manageItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
                    pathname === item.href
                      ? 'bg-surface-sunken text-content font-medium'
                      : 'text-content-muted hover:bg-surface-hover hover:text-content',
                  )}
                >
                  {item.href.endsWith('/manage') ? <Settings size={16} aria-hidden /> : null}
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </nav>
  )
}
