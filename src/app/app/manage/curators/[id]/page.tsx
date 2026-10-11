import { notFound } from 'next/navigation'

import { getOwnCurator } from '@/modules/club/service'
import { routes } from '@/shared/routes'
import { LinkButton } from '@/ui'

import { PageIntro } from '../../../_components/page-intro'
import { getViewer, viewerCan, viewerCanOn } from '../../../_lib/viewer'
import { CuratorForm } from '../_components/curator-form'
import { CuratorVisibility } from '../_components/curator-visibility'

export const metadata = { title: 'Карточка куратора' }

type Props = { params: Promise<{ id: string }> }

/**
 * Редактор карточки куратора.
 *
 * ─────────────────────────────────────────────────────────────────
 * ОДИН АДРЕС И ДЛЯ СВОЕЙ КАРТОЧКИ, И ДЛЯ ЧУЖОЙ
 *
 * Куратор попадает сюда со своей страницы кнопкой «Редактировать»
 * (контекстное редактирование из PRD v0.3 §1.1), старший — из списка
 * управления. Экран один и тот же; различие только в том, что старший
 * видит ещё и удаление.
 *
 * Разводить их по разным адресам значило бы держать две формы, которые
 * обязаны совпадать поле в поле, — и однажды они разойдутся.
 * ─────────────────────────────────────────────────────────────────
 */
export default async function EditCuratorPage({ params }: Props) {
  const viewer = await getViewer()
  const { id } = await params

  if (!viewer.userId) notFound()

  // Право проверяется по владельцу карточки: `own` здесь означает
  // «про меня самого» — единственное место на платформе, где владелец
  // и есть предмет записи
  if (!viewerCanOn(viewer, 'curators.edit', id)) notFound()

  const curator = await getOwnCurator(id)
  if (!curator) notFound()

  return (
    <>
      <PageIntro
        title={curator.displayName}
        description="Как вас видят участники на странице «Кураторы»"
        actions={
          <LinkButton href={routes.app.club.curator(curator.slug)} variant="secondary" size="sm">
            Как видят участники
          </LinkButton>
        }
      />

      <div className="space-y-8">
        <CuratorVisibility
          userId={curator.userId}
          isPublic={curator.isPublic}
          canDelete={viewerCan(viewer, 'curators.edit')}
        />

        <CuratorForm curator={curator} />
      </div>
    </>
  )
}
