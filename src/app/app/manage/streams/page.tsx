import { notFound } from 'next/navigation'

import { streamStrings } from '@/modules/streams'
import type { StreamState } from '@/modules/streams'
import { getManagedStreams } from '@/modules/streams/editor-service'
import type { PublicationStatus } from '@/shared/db/enums'
import { routes } from '@/shared/routes'
import { EmptyState, LinkButton } from '@/ui'

import { PageIntro } from '../../_components/page-intro'
import { getViewer, viewerCan } from '../../_lib/viewer'

import { ManageStreamFilters } from './_components/manage-stream-filters'
import { ManageStreamRow } from './_components/manage-stream-row'

export const metadata = { title: 'Эфиры: управление' }

/**
 * Список эфиров для куратора.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЭТО НЕ АРХИВ УЧАСТНИКА С ДРУГИМИ КНОПКАМИ
 *
 * Архив отвечает на вопрос «что посмотреть»: обложки, поиск по теме,
 * длительность. Здесь вопрос другой — «что у нас в работе»: этап,
 * виден ли эфир участникам, приложена ли запись, есть ли оглавление.
 *
 * Сортировка по дате эфира, а не по времени правки, — в отличие
 * от разборов. У эфира есть место во времени, и куратор ищет «тот,
 * что был в субботу», а не «тот, который я трогал последним».
 * ─────────────────────────────────────────────────────────────────
 */

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const STATES: StreamState[] = ['scheduled', 'live', 'recorded', 'cancelled']
const STATUSES: PublicationStatus[] = ['draft', 'published', 'archived']

export default async function ManageStreamsPage({ searchParams }: Props) {
  const viewer = await getViewer()

  // Раздела управления не существует для того, у кого нет прав:
  // не «нет доступа», а «нет такой страницы». Меньше поводов гадать,
  // что там прячут
  if (!viewerCan(viewer, 'streams.view_drafts') && !viewerCan(viewer, 'streams.create')) {
    notFound()
  }

  const query = await searchParams
  const state = single(query.state)
  const status = single(query.status)
  const onlyMine = single(query.mine) === '1'

  const streams = await getManagedStreams(viewer.userId as string, {
    state: STATES.includes(state as StreamState) ? (state as StreamState) : null,
    status: STATUSES.includes(status as PublicationStatus) ? (status as PublicationStatus) : null,
    curatorId: onlyMine ? (viewer.userId as string) : null,
    query: single(query.q),
  })

  const canCreate = viewerCan(viewer, 'streams.create')

  return (
    <>
      <PageIntro
        title={streamStrings.manage.title}
        description={streamStrings.manage.description}
        actions={
          <LinkButton href={routes.app.streams.index()} variant="secondary" size="sm">
            {streamStrings.manage.openForMembers}
          </LinkButton>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <ManageStreamFilters state={state} onlyMine={onlyMine} />

        {canCreate ? (
          <LinkButton href={routes.app.manage.newStream()}>
            {streamStrings.manage.create}
          </LinkButton>
        ) : null}
      </div>

      {streams.length === 0 ? (
        <EmptyState
          className="border-border mt-8 rounded-lg border border-dashed"
          title={
            state || onlyMine ? streamStrings.manage.emptyFiltered : streamStrings.manage.empty
          }
          description={
            state || onlyMine
              ? streamStrings.manage.emptyFilteredHint
              : streamStrings.manage.emptyHint
          }
          action={
            canCreate ? (
              <LinkButton href={routes.app.manage.newStream()} variant="secondary">
                {streamStrings.manage.create}
              </LinkButton>
            ) : undefined
          }
        />
      ) : (
        <ul className="border-border divide-border mt-6 divide-y overflow-hidden rounded-lg border">
          {streams.map((stream) => (
            <li key={stream.id}>
              <ManageStreamRow stream={stream} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function single(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value

  return first?.trim() || null
}
