import type { CourseSummary } from '@/modules/course'
import { courseStrings } from '@/modules/course'

/**
 * Итог по курсу над картой.
 *
 * ─────────────────────────────────────────────────────────────────
 * ОТВЕЧАЕТ НА ДВА ВОПРОСА, А НЕ ПОКАЗЫВАЕТ ЦИФРЫ
 *
 *   «Где я?»            → модуль 2 из 3
 *   «Сколько осталось?» → около 63 минут
 *
 * Второй вопрос важнее первого и почти всегда остаётся без ответа
 * в учебных платформах. Процент на него не отвечает: «28%» не говорит
 * человеку, хватит ли субботнего вечера.
 * ─────────────────────────────────────────────────────────────────
 *
 * Полоса — фирменный маркер из логотипа, тот же приём, что подсвечивает
 * найденное в поиске. Заливка идёт по строке с итогом, а не отдельной
 * чертой: меньше элементов, тот же смысл.
 */

type CourseProgressProps = {
  summary: CourseSummary
}

export function CourseProgress({ summary }: CourseProgressProps) {
  const strings = courseStrings.map

  return (
    <section className="border-border bg-surface-raised mt-8 rounded-xl border p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="font-display text-lg font-bold">
          {strings.progress(summary.percent)}
          <span className="text-content-muted ml-2 text-sm font-normal">
            {strings.lessonsCount(summary.completedLessons, summary.totalLessons)}
          </span>
        </p>

        <p className="text-content-muted text-sm">
          {summary.currentModuleNumber
            ? strings.modulePosition(summary.currentModuleNumber, summary.totalModules)
            : strings.finished}
          {summary.remainingMinutes > 0 ? ` · ${strings.remaining(summary.remainingMinutes)}` : ''}
        </p>
      </div>

      {/* Полоса прогресса. `aria-*` обязательны: экранный диктор
          иначе прочитает пустой прямоугольник */}
      <div
        role="progressbar"
        aria-valuenow={summary.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={strings.progress(summary.percent)}
        className="bg-surface-sunken mt-4 h-2 w-full overflow-hidden rounded-full"
      >
        <div
          className="bg-accent h-full rounded-full transition-[width] duration-500"
          style={{ width: `${summary.percent}%` }}
        />
      </div>
    </section>
  )
}
