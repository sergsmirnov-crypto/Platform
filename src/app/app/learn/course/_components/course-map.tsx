import { Check, CirclePlay, FileText } from 'lucide-react'
import Link from 'next/link'

import { courseStrings, findNextLesson, summarizeModule } from '@/modules/course'
import type { LessonListItem, ModuleListItem } from '@/modules/course'
import { routes } from '@/shared/routes'
import { Badge, cn } from '@/ui'

/**
 * Вертикальный путь курса.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЧТО ЗДЕСЬ ГЛАВНОЕ
 *
 * Ровно один элемент на странице выглядит иначе остальных — следующий
 * незакрытый урок. Всё прочее оформление подчинено тому, чтобы его
 * было видно, не читая страницу.
 *
 * Пройденные модули свёрнуты: человек на двадцатом уроке не должен
 * прокручивать девятнадцать пройденных, чтобы дойти до своего места.
 * Развернуть можно — иногда нужно вернуться и повторить.
 * ─────────────────────────────────────────────────────────────────
 *
 * Сворачивание сделано на `<details>`: это работает без кода в браузере,
 * переживает перезагрузку страницы и правильно читается экранным
 * диктором. Своё состояние с кнопкой дало бы то же самое, но ценой
 * клиентского компонента на всю страницу.
 */

type CourseMapProps = {
  modules: ModuleListItem[]
}

export function CourseMapView({ modules }: CourseMapProps) {
  const next = findNextLesson(modules)

  return (
    <ol className="space-y-4">
      {modules.map((module, index) => (
        <ModuleNode
          key={module.id}
          module={module}
          number={index + 1}
          nextLessonId={next?.lesson.id ?? null}
        />
      ))}
    </ol>
  )
}

function ModuleNode({
  module,
  number,
  nextLessonId,
}: {
  module: ModuleListItem
  number: number
  nextLessonId: string | null
}) {
  const summary = summarizeModule(module)
  const containsNext = module.lessons.some((lesson) => lesson.id === nextLessonId)

  // Свёрнут, если пройден целиком и не содержит следующего урока.
  // Модуль, до которого человек ещё не дошёл, оставляем открытым:
  // он должен видеть, что его ждёт
  const openByDefault = !summary.isComplete || containsNext

  return (
    <li id={module.slug} className="border-border bg-surface-raised rounded-xl border">
      <details open={openByDefault}>
        <summary className="hover:bg-surface-hover flex cursor-pointer items-center gap-4 rounded-xl px-5 py-4 transition-colors">
          <ModuleBadge number={number} isComplete={summary.isComplete} />

          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {module.title}
              {module.isDraft ? <Badge variant="draft">{courseStrings.map.draft}</Badge> : null}
            </p>
            {module.description ? (
              <p className="text-content-muted mt-0.5 text-sm">{module.description}</p>
            ) : null}
          </div>

          <p className="text-content-muted shrink-0 text-sm tabular-nums">
            {courseStrings.map.lessonsCount(summary.completed, summary.total)}
          </p>
        </summary>

        <ul className="border-border space-y-1 border-t px-3 py-3">
          {module.lessons.map((lesson) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              moduleSlug={module.slug}
              isNext={lesson.id === nextLessonId}
            />
          ))}

          {module.lessons.length === 0 ? (
            <li className="text-content-muted px-3 py-2 text-sm">
              {courseStrings.map.emptyModule}
            </li>
          ) : null}
        </ul>
      </details>
    </li>
  )
}

/** Номер модуля или галочка, если он закрыт */
function ModuleBadge({ number, isComplete }: { number: number; isComplete: boolean }) {
  return (
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
        isComplete ? 'bg-accent text-on-accent' : 'bg-surface-sunken text-content-muted',
      )}
      aria-hidden
    >
      {isComplete ? <Check size={18} /> : number}
    </span>
  )
}

function LessonRow({
  lesson,
  moduleSlug,
  isNext,
}: {
  lesson: LessonListItem
  moduleSlug: string
  isNext: boolean
}) {
  const strings = courseStrings

  return (
    <li>
      <Link
        href={routes.app.learn.lesson(moduleSlug, lesson.slug)}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
          isNext ? 'bg-accent-soft' : 'hover:bg-surface-hover',
        )}
      >
        <LessonMark completed={lesson.completed} isNext={isNext} hasVideo={lesson.hasVideo} />

        <span className="min-w-0 flex-1">
          <span className={cn('block truncate', isNext && 'font-semibold')}>{lesson.title}</span>
          {lesson.summary ? (
            <span className="text-content-muted block truncate text-sm">{lesson.summary}</span>
          ) : null}
        </span>

        <span className="flex shrink-0 items-center gap-2">
          {lesson.isDraft ? <Badge variant="draft">{strings.map.draft}</Badge> : null}
          {lesson.isFreePreview ? <Badge variant="outline">{strings.map.freePreview}</Badge> : null}
          {lesson.estimatedMinutes ? (
            <span className="text-content-muted text-sm tabular-nums">
              {strings.lesson.duration(lesson.estimatedMinutes)}
            </span>
          ) : null}
        </span>
      </Link>
    </li>
  )
}

/**
 * Значок слева от урока.
 *
 * Три состояния и ни одного замка: уроки не запираются (ADR-0019
 * и решение владельца продукта). Замок здесь появился бы только вместе
 * с блокировкой прохождения, которой у нас нет.
 */
function LessonMark({
  completed,
  isNext,
  hasVideo,
}: {
  completed: boolean
  isNext: boolean
  hasVideo: boolean
}) {
  if (completed) {
    return (
      <span className="bg-accent text-on-accent flex size-6 shrink-0 items-center justify-center rounded-full">
        <Check size={14} aria-hidden />
        <span className="sr-only">{courseStrings.lesson.completed}</span>
      </span>
    )
  }

  const Icon = hasVideo ? CirclePlay : FileText

  return (
    <Icon
      size={20}
      className={cn('shrink-0', isNext ? 'text-accent' : 'text-content-subtle')}
      aria-hidden
    />
  )
}
