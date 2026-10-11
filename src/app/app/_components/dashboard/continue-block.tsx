import { Play } from 'lucide-react'
import Link from 'next/link'

import { findResumeCard } from '../../_lib/resume'
import { getContentViewer } from '../../_lib/viewer'

import type { ResumeCard } from '../../_lib/resume'

/**
 * «Продолжить» — главная кнопка платформы.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПРОДОЛЖЕНИЕ ВАЖНЕЕ НАЧАЛА (PRD §1.3, принцип 3)
 *
 * Человек с двадцатью свободными минутами не выбирает, чем заняться, —
 * он возвращается к тому, что бросил в прошлый раз. Экран, начинающийся
 * с выбора, тратит эти двадцать минут на выбор.
 *
 * Поэтому блок стоит первым после приветствия, содержит ровно одно
 * действие и не предлагает альтернатив.
 * ─────────────────────────────────────────────────────────────────
 *
 * Новичку, который ещё ничего не открывал, блок предлагает первый урок
 * курса — то есть выглядит как «Начать». Отдельного состояния для этого
 * не заводится: одна кнопка с одним действием одинаково хороша и для
 * возвращения, и для начала.
 */
export async function ContinueBlock() {
  // Черновики здесь не нужны: «Продолжить» показывает то, что человек
  // уже открывал, а неопубликованное он открыть не мог. Право спрашиваем
  // курса — оно шире, куратор курса увидит и свой черновик
  const viewer = await getContentViewer('course.view_drafts')
  if (!viewer) return null

  // Что именно предложить, решает `findResumeCard`: брошенное
  // на середине, а если такого нет — следующий урок курса. Пустой
  // ответ означает, что курс пройден целиком и предлагать нечего
  const card = await findResumeCard(viewer)
  if (!card) return null

  return (
    <section>
      <h2 className="text-content-muted mb-3 text-sm font-semibold tracking-wide uppercase">
        Продолжить
      </h2>

      <Link
        href={card.href}
        className="border-border bg-surface-raised hover:border-border-strong group block overflow-hidden rounded-xl border transition-colors"
      >
        <div className="flex items-center gap-4 p-5">
          <span className="bg-accent text-on-accent flex size-12 shrink-0 items-center justify-center rounded-full">
            <Play size={20} fill="currentColor" aria-hidden />
          </span>

          <span className="min-w-0 flex-1">
            <span className="text-content-muted block text-xs">{kindLabel(card.kind)}</span>
            <span className="block truncate text-lg font-semibold">{card.title}</span>
            <span className="text-content-muted block truncate text-sm">{card.subtitle}</span>
          </span>

          {card.percent > 0 ? (
            <span className="text-content-muted shrink-0 text-sm tabular-nums">
              {card.percent}%
            </span>
          ) : null}
        </div>

        {/* Полоса прогресса по нижнему краю карточки. Отдельной строки
            не занимает, но сразу отвечает на вопрос «сколько осталось» */}
        <span className="bg-surface-sunken block h-1 w-full">
          <span
            className="bg-accent block h-full transition-[width] duration-500"
            style={{ width: `${Math.max(card.percent, 2)}%` }}
          />
        </span>
      </Link>
    </section>
  )
}

const KIND_LABELS: Record<ResumeCard['kind'], string> = {
  lesson: 'Урок курса',
  arrangement: 'Разбор песни',
  stream: 'Запись эфира',
}

function kindLabel(kind: ResumeCard['kind']): string {
  return KIND_LABELS[kind]
}
