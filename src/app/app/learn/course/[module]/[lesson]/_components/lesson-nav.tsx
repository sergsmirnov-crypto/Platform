import { ArrowLeft, ArrowRight } from 'lucide-react'
import Link from 'next/link'

import { courseStrings } from '@/modules/course'
import type { LessonNeighbours } from '@/modules/course'
import { routes } from '@/shared/routes'

/**
 * Переход к соседним урокам.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПЕРЕХОД ЧЕРЕЗ ГРАНИЦУ МОДУЛЯ ОБЯЗАТЕЛЕН
 *
 * Для человека курс — одна дорожка; деление на модули он воспринимает
 * как главы книги. Упереться в конец модуля и не понять, как двигаться
 * дальше, — самая обидная поломка навигации, потому что выглядит она
 * как конец курса.
 *
 * Поэтому под названием следующего урока подписан его модуль, если
 * модуль другой: человек видит, что переходит в новую главу, и не
 * удивляется смене темы.
 * ─────────────────────────────────────────────────────────────────
 */

type LessonNavProps = {
  neighbours: LessonNeighbours
  currentModuleSlug: string
}

export function LessonNav({ neighbours, currentModuleSlug }: LessonNavProps) {
  const { previous, next } = neighbours

  if (!previous && !next) return null

  return (
    <nav className="border-border mt-12 grid gap-3 border-t pt-6 sm:grid-cols-2">
      {previous ? (
        <NavLink
          direction="previous"
          moduleSlug={previous.module.slug}
          moduleTitle={previous.module.slug === currentModuleSlug ? null : previous.module.title}
          lessonSlug={previous.lesson.slug}
          title={previous.lesson.title}
        />
      ) : (
        <span />
      )}

      {next ? (
        <NavLink
          direction="next"
          moduleSlug={next.module.slug}
          moduleTitle={next.module.slug === currentModuleSlug ? null : next.module.title}
          lessonSlug={next.lesson.slug}
          title={next.lesson.title}
        />
      ) : null}
    </nav>
  )
}

function NavLink({
  direction,
  moduleSlug,
  moduleTitle,
  lessonSlug,
  title,
}: {
  direction: 'previous' | 'next'
  moduleSlug: string
  moduleTitle: string | null
  lessonSlug: string
  title: string
}) {
  const isNext = direction === 'next'

  return (
    <Link
      href={routes.app.learn.lesson(moduleSlug, lessonSlug)}
      className={`border-border hover:border-border-strong hover:bg-surface-hover flex items-center gap-3 rounded-xl border p-4 transition-colors ${
        isNext ? 'sm:col-start-2 sm:text-right' : ''
      }`}
    >
      {!isNext ? (
        <ArrowLeft size={18} className="text-content-subtle shrink-0" aria-hidden />
      ) : null}

      <span className="min-w-0 flex-1">
        <span className="text-content-muted block text-xs">
          {isNext ? courseStrings.lesson.next : courseStrings.lesson.previous}
        </span>
        <span className="block truncate font-medium">{title}</span>
        {moduleTitle ? (
          <span className="text-content-muted block truncate text-xs">{moduleTitle}</span>
        ) : null}
      </span>

      {isNext ? (
        <ArrowRight size={18} className="text-content-subtle shrink-0" aria-hidden />
      ) : null}
    </Link>
  )
}
