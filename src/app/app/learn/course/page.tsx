import { courseStrings, summarizeCourse } from '@/modules/course'
import { getCourseMap } from '@/modules/course/service'
import { EmptyState } from '@/ui'

import { PageIntro } from '../../_components/page-intro'
import { getContentViewer } from '../../_lib/viewer'

import { CourseMapView } from './_components/course-map'
import { CourseProgress } from './_components/course-progress'

export const metadata = { title: courseStrings.title }

/**
 * Карта курса.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПУТЬ, А НЕ СЕТКА КАРТОЧЕК
 *
 * Разборы — библиотека, и сетка карточек для них правильна: человек
 * выбирает. Курс проходят по порядку, и сетка здесь врёт — она
 * показывает сорок равнозначных вариантов там, где верный ровно один:
 * следующий.
 *
 * Поэтому вертикальный список сверху вниз, пройденные модули свёрнуты,
 * а следующий урок выделен так, что мимо него не пройти.
 * ─────────────────────────────────────────────────────────────────
 *
 * Страница собирается целиком на сервере: разворачивание модулей сделано
 * на `<details>`, а не на состоянии в браузере. Кода в браузере нет вовсе.
 */
export default async function CoursePage() {
  const viewer = await getContentViewer('course.view_drafts')
  if (!viewer) return null

  const course = await getCourseMap(viewer)

  if (!course || course.modules.length === 0) {
    return (
      <>
        <PageIntro title={courseStrings.title} />
        <EmptyState
          title={courseStrings.map.empty}
          description={courseStrings.map.emptyHint}
          className="border-border mt-8 rounded-lg border border-dashed"
        />
      </>
    )
  }

  const summary = summarizeCourse(course.modules)

  return (
    <>
      <PageIntro title={course.title} description={course.description ?? undefined} />

      <CourseProgress summary={summary} />

      <div className="mt-10">
        <CourseMapView modules={course.modules} />
      </div>
    </>
  )
}
