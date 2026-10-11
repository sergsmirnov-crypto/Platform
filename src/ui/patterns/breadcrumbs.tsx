import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'

import { cn } from '@/ui/lib/cn'

/**
 * Хлебные крошки.
 *
 * Компонент ничего не знает о структуре платформы: цепочка приходит
 * готовой. Строит её слой приложения, здесь только отрисовка.
 *
 * **На телефоне показывается один шаг назад, а не вся цепочка.**
 * Полный путь из четырёх звеньев занимает на узком экране две строки
 * и вытесняет заголовок за пределы первого экрана — а человек с гитарой
 * в руках смотрит на страницу секунду. Один крупный переход наверх
 * решает ту же задачу и попадает под палец.
 */

type BreadcrumbsProps = {
  items: { href: string; label: string }[]
  className?: string | undefined
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length < 2) return null

  const parent = items[items.length - 2]

  return (
    <nav aria-label="Навигационная цепочка" className={cn('mb-3', className)}>
      {/* Телефон: один шаг наверх */}
      {parent ? (
        <Link
          href={parent.href}
          className="text-content-muted hover:text-content inline-flex min-h-11 items-center gap-1 text-sm sm:hidden"
        >
          <ChevronLeft size={16} aria-hidden />
          {parent.label}
        </Link>
      ) : null}

      {/* Компьютер: полная цепочка */}
      <ol className="text-content-muted hidden items-center gap-1 text-sm sm:flex">
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          return (
            <li key={item.href} className="flex min-w-0 items-center gap-1">
              {index > 0 ? (
                <ChevronRight size={14} aria-hidden className="text-content-subtle shrink-0" />
              ) : null}

              {isLast ? (
                <span aria-current="page" className="text-content truncate">
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className="hover:text-content max-w-48 truncate">
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
