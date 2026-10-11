import { streamStrings } from '@/modules/streams'
import { getUpcomingStreams } from '@/modules/streams/service'
import { appConfig } from '@/shared/config/app.config'
import { routes } from '@/shared/routes'
import { EmptyState, LinkButton } from '@/ui'

import { PageIntro } from '../../_components/page-intro'
import { getContentViewer } from '../../_lib/viewer'
import { StreamCardItem } from '../_components/stream-card'

export const metadata = { title: 'Ближайшие эфиры' }

/**
 * Ближайшие эфиры.
 *
 * ─────────────────────────────────────────────────────────────────
 * КОРОТКИЙ СПИСОК БЕЗ ФИЛЬТРОВ — И ЭТО НЕ УПУЩЕНИЕ
 *
 * Анонсов всегда единицы: клуб проводит эфир раз в неделю и объявляет
 * его за несколько дней. Поиск и отбор по куратору здесь искали бы
 * среди трёх строк.
 *
 * Пустое состояние тоже частое и нормальное: между эфирами анонсов
 * нет вовсе. Поэтому оно не выглядит поломкой и сразу уводит в архив —
 * туда, где смотреть есть что.
 * ─────────────────────────────────────────────────────────────────
 */
export default async function UpcomingStreamsPage() {
  const viewer = await getContentViewer('streams.view_drafts')
  if (!viewer) return null

  const streams = await getUpcomingStreams(viewer, appConfig.streams.upcomingLimit)

  return (
    <>
      <PageIntro
        title={streamStrings.list.upcoming}
        description={streamStrings.list.upcomingHint}
        actions={
          <LinkButton href={routes.app.streams.index()} variant="secondary" size="sm">
            {streamStrings.list.archive}
          </LinkButton>
        }
      />

      {streams.length === 0 ? (
        <EmptyState
          title={streamStrings.list.emptyUpcoming}
          description={streamStrings.list.archiveHint}
          action={
            <LinkButton href={routes.app.streams.index()} variant="secondary">
              {streamStrings.list.archive}
            </LinkButton>
          }
          className="border-border rounded-lg border border-dashed"
        />
      ) : (
        <ul className="space-y-3">
          {streams.map((stream) => (
            <li key={stream.id}>
              <StreamCardItem stream={stream} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
