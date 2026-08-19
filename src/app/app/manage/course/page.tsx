import { courseStrings } from '@/modules/course'
import { getCourseTree } from '@/modules/course/editor-service'
import { routes } from '@/shared/routes'
import { LinkButton } from '@/ui'

import { PageIntro } from '../../_components/page-intro'
import { getViewer, viewerCan } from '../../_lib/viewer'

import { CourseTree } from './_components/course-tree'

export const metadata = { title: 'Курс: управление' }

/**
 * Управление курсом.
 *
 * ─────────────────────────────────────────────────────────────────
 * ОДНА СТРАНИЦА НА ВЕСЬ КУРС
 *
 * Модули и уроки правятся прямо в дереве, без перехода на отдельные
 * страницы. Причина та же, по которой редактор разбора собран
 * на одной странице (ADR-0015): куратор, ушедший править урок
 * на отдельный экран, теряет из виду, где этот урок стоит в курсе, —
 * а порядок здесь и есть главное содержание.
 * ─────────────────────────────────────────────────────────────────
 *
 * Курс заводится сам при первом открытии этой страницы: заставлять
 * куратора сначала «создать курс», когда курс в клубе ровно один, —
 * лишний шаг ради формальности.
 */
export default async function ManageCoursePage() {
  const viewer = await getViewer()
  if (!viewer.userId) return null

  // Право проверяется и здесь, и в сервисе. Здесь — чтобы показать
  // понятный отказ вместо ошибки; там — потому что это защита,
  // а не удобство интерфейса
  if (!viewerCan(viewer, 'course.view_drafts')) {
    return (
      <>
        <PageIntro title={courseStrings.manage.title} />
        <p className="text-content-muted mt-6">Нет доступа к управлению курсом.</p>
      </>
    )
  }

  const tree = await getCourseTree(viewer.userId)

  return (
    <>
      <PageIntro
        title={courseStrings.manage.title}
        description={courseStrings.manage.description}
        actions={
          <LinkButton href={routes.app.learn.course()} variant="secondary" size="sm">
            {courseStrings.manage.openForMembers}
          </LinkButton>
        }
      />

      <div className="mt-8">
        <CourseTree modules={tree.modules} />
      </div>
    </>
  )
}
