import { notFound } from 'next/navigation'

import { findManagedSongs } from '@/modules/songs/editor-repository'
import type { PublicationStatus } from '@/shared/db/enums'
import { routes } from '@/shared/routes'
import { EmptyState, LinkButton } from '@/ui'

import { PageIntro } from '../../_components/page-intro'
import { getViewer, viewerCan } from '../../_lib/viewer'

import { ManageFilters } from './_components/manage-filters'
import { ManageSongRow } from './_components/manage-song-row'

export const metadata = { title: 'Разборы: управление' }

/**
 * Список разборов для куратора.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЭТО НЕ КАТАЛОГ УЧАСТНИКА С ДРУГИМИ КНОПКАМИ
 *
 * Каталог отвечает на вопрос «что мне разобрать»: обложки, уровни,
 * фильтры по строю. Здесь вопрос другой — «что у нас в работе»:
 * состояние публикации, сколько вариантов готово, когда правили
 * последний раз, чьё это.
 *
 * Поэтому список, а не сетка карточек: строки сравниваются глазами
 * сверху вниз, карточки — нет. И сортировка по времени изменения,
 * а не по новизне: куратор возвращается к тому, что не доделал.
 * ─────────────────────────────────────────────────────────────────
 */

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const STATUSES: PublicationStatus[] = ['draft', 'published', 'archived']

export default async function ManageSongsPage({ searchParams }: Props) {
  const viewer = await getViewer()

  // Раздел управления не должен существовать для того, у кого нет прав:
  // не «нет доступа», а «нет такой страницы». Меньше поводов гадать,
  // что там прячут
  if (!viewerCan(viewer, 'songs.view_drafts') && !viewerCan(viewer, 'songs.create')) {
    notFound()
  }

  const query = await searchParams
  const status = single(query.status)
  const onlyMine = single(query.mine) === '1'

  const songs = await findManagedSongs({
    status: STATUSES.includes(status as PublicationStatus) ? (status as PublicationStatus) : null,
    curatorId: onlyMine ? viewer.userId : null,
    query: single(query.q),
  })

  return (
    <>
      <PageIntro title="Разборы" />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <ManageFilters status={status} onlyMine={onlyMine} />

        {viewerCan(viewer, 'songs.create') ? (
          <LinkButton href={routes.app.manage.newSong()}>Новый разбор</LinkButton>
        ) : null}
      </div>

      {songs.length === 0 ? (
        <EmptyState
          className="border-border mt-8 rounded-lg border border-dashed"
          title="Ничего не найдено"
          description={
            onlyMine || status
              ? 'Попробуйте снять фильтры'
              : 'Заведите первый разбор — это займёт пару минут'
          }
          action={
            viewerCan(viewer, 'songs.create') ? (
              <LinkButton href={routes.app.manage.newSong()} variant="secondary">
                Новый разбор
              </LinkButton>
            ) : undefined
          }
        />
      ) : (
        <ul className="border-border divide-border mt-6 divide-y overflow-hidden rounded-lg border">
          {songs.map((song) => (
            <li key={song.id}>
              <ManageSongRow song={song} />
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
