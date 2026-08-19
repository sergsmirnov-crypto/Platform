import { getCourseCompletion } from '@/modules/course/service'
import { completionPercent } from '@/modules/progress'
import { routes } from '@/shared/routes'
import { EmptyState, LinkButton } from '@/ui'

import { PageIntro } from '../../_components/page-intro'
import { findResumeCards } from '../../_lib/resume'
import { getContentViewer } from '../../_lib/viewer'

import { ProgressStat } from './_components/progress-stat'
import { RecentList } from './_components/recent-list'

export const metadata = { title: 'Мой прогресс' }

/**
 * Личный прогресс.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПООЩРЯЕТ, НО НЕ НАКАЗЫВАЕТ
 *
 * Здесь сознательно нет ни серий занятий, ни сравнения с другими
 * участниками (PRD §0, пункт 6). Взрослый человек бросает гитару
 * на две недели и возвращается — сгоревшая серия превращает это
 * возвращение в стыд, а стыд гонит из клуба.
 *
 * Поэтому страница отвечает только на «что я успел» и «к чему вернуться»,
 * и ни на один вопрос вида «почему ты пропустил».
 * ─────────────────────────────────────────────────────────────────
 */
export default async function ProgressPage() {
  const viewer = await getContentViewer('course.view_drafts')
  if (!viewer) return null

  const [course, recent] = await Promise.all([
    getCourseCompletion(viewer),
    findResumeCards(viewer, 8),
  ])

  const hasAnything = course.completed > 0 || recent.length > 0

  return (
    <>
      <PageIntro title="Мой прогресс" />

      {hasAnything ? (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <ProgressStat
              label="Курс пройден"
              value={`${completionPercent(course)}%`}
              hint={`${course.completed} из ${course.total} уроков`}
            />
            <ProgressStat
              label="Уроков закончено"
              value={String(course.completed)}
              hint={
                course.total > course.completed
                  ? `осталось ${course.total - course.completed}`
                  : 'весь курс'
              }
            />
            <ProgressStat
              label="Разборов начато"
              value={String(recent.filter((card) => card.kind === 'arrangement').length)}
              hint="за последнее время"
            />
          </div>

          <section className="mt-12">
            <h2 className="font-display mb-4 text-xl font-bold">Недавнее</h2>
            <RecentList cards={recent} />
          </section>
        </>
      ) : (
        <EmptyState
          title="Пока пусто"
          description="Откройте первый урок курса или разбор — прогресс появится здесь сам"
          action={<LinkButton href={routes.app.learn.course()}>Начать курс</LinkButton>}
          className="border-border mt-8 rounded-lg border border-dashed"
        />
      )}
    </>
  )
}
