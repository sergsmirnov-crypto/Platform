import { notFound } from 'next/navigation'

import { clubStrings } from '@/modules/club'
import { getCuratorBySlug } from '@/modules/club/service'
import { buildCatalogQuery } from '@/modules/songs'
import { getCatalogPage } from '@/modules/songs/service'
import { buildArchiveQuery } from '@/modules/streams'
import { getStreamArchive } from '@/modules/streams/service'
import { routes } from '@/shared/routes'
import { Avatar, Badge, LinkButton, PillLink } from '@/ui'

import { PageIntro } from '../../../_components/page-intro'
import { getContentViewer, getViewer, viewerCan, viewerCanOn } from '../../../_lib/viewer'
import { SongCardItem } from '../../../learn/songs/_components/song-card'
import { StreamCardItem } from '../../../streams/_components/stream-card'

import type { Metadata } from 'next'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const viewer = await getViewer()
  if (!viewer.userId) return { title: clubStrings.curators.title }

  const { slug } = await params
  const curator = await getCuratorBySlug(
    { userId: viewer.userId, canSeeHidden: viewerCan(viewer, 'curators.edit') },
    slug,
  )

  return curator
    ? { title: curator.displayName, description: curator.headline ?? undefined }
    : { title: clubStrings.curators.title }
}

/**
 * Страница куратора.
 *
 * ─────────────────────────────────────────────────────────────────
 * СНАЧАЛА ЧЕЛОВЕК, ПОТОМ ЕГО РАБОТА — И РАБОТЫ БОЛЬШЕ
 *
 * Биография вверху короткая, а под ней — разборы и эфиры, которые он
 * вёл. Так эта страница перестаёт быть визиткой «для галочки»
 * и становится входом в библиотеку: человек пришёл почитать про Ивана,
 * а ушёл разбирать его песню.
 *
 * Содержимое собирается здесь, а не в модуле клуба: клуб не знает
 * ни о разборах, ни об эфирах, и это правильно — иначе «удалить раздел
 * эфиров» перестало бы быть удалением одной папки (ARCHITECTURE §3).
 * ─────────────────────────────────────────────────────────────────
 */
export default async function CuratorPage({ params }: Props) {
  const viewer = await getViewer()
  if (!viewer.userId) return null

  const { slug } = await params
  const canSeeHidden = viewerCan(viewer, 'curators.edit')

  const curator = await getCuratorBySlug({ userId: viewer.userId, canSeeHidden }, slug)
  if (!curator) notFound()

  const [songViewer, streamViewer] = await Promise.all([
    getContentViewer('songs.view_drafts'),
    getContentViewer('streams.view_drafts'),
  ])

  const [songs, streams] = await Promise.all([
    songViewer
      ? getCatalogPage(songViewer, {
          query: null,
          levels: [],
          tunings: [],
          tags: [],
          curatorId: curator.userId,
          maxMinutes: null,
          sort: 'new',
          page: 1,
          includeDrafts: songViewer.canSeeDrafts,
        })
      : null,
    streamViewer
      ? getStreamArchive(streamViewer, { query: null, curatorId: curator.userId, page: 1 })
      : null,
  ])

  const canEdit = viewerCanOn(viewer, 'curators.edit', curator.userId)

  return (
    <>
      <div className="mb-8 flex flex-wrap items-start gap-6">
        <Avatar src={curator.avatarUrl} alt={curator.displayName} size="xl" />

        <div className="min-w-0 flex-1">
          <PageIntro
            title={curator.displayName}
            description={curator.headline ?? undefined}
            actions={
              canEdit ? (
                <LinkButton
                  href={routes.app.manage.curator(curator.userId)}
                  variant="secondary"
                  size="sm"
                >
                  {' '}
                  {/* prettier-ignore */}
                  {clubStrings.curators.edit}
                </LinkButton>
              ) : undefined
            }
          />

          <p className="text-content-muted flex flex-wrap items-center gap-2 text-sm">
            {curator.city ? <span>{curator.city}</span> : null}
            {curator.teachingYears ? (
              <span>· {clubStrings.curators.experience(curator.teachingYears)}</span>
            ) : null}
            {!curator.isPublic ? (
              <Badge variant="draft" size="sm">
                {clubStrings.curators.hidden}
              </Badge>
            ) : null}
          </p>
        </div>
      </div>

      {curator.bio ? (
        <div className="mb-10 max-w-prose whitespace-pre-line">{curator.bio}</div>
      ) : null}

      <div className="mb-12 grid gap-6 sm:grid-cols-2">
        <FactList title={clubStrings.curators.teaches} items={curator.teaches} />
        <FactList title={clubStrings.curators.influences} items={curator.influences} />
        <FactList title={clubStrings.curators.gear} items={curator.gear} />
        <FactList title={clubStrings.curators.genres} items={curator.favoriteGenres} />
      </div>

      {songs && songs.items.length > 0 ? (
        <section className="mb-12">
          <SectionHeading
            title={clubStrings.curators.songs}
            href={`${routes.app.learn.songs()}${buildCatalogQuery({ curatorId: curator.userId })}`}
            linkLabel={clubStrings.curators.allSongs}
          />

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {songs.items.slice(0, 6).map((song) => (
              <li key={song.id}>
                <SongCardItem song={song} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {streams && streams.items.length > 0 ? (
        <section className="mb-12">
          <SectionHeading
            title={clubStrings.curators.streams}
            href={`${routes.app.streams.index()}${buildArchiveQuery({ curatorId: curator.userId })}`}
            linkLabel={clubStrings.curators.allStreams}
          />

          <ul className="space-y-3">
            {streams.items.slice(0, 4).map((stream) => (
              <li key={stream.id}>
                <StreamCardItem stream={stream} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Пустая страница у нового куратора — обычное дело, а не поломка:
          карточка заводится до того, как человек что-либо опубликовал */}
      {!songs?.items.length && !streams?.items.length ? (
        <p className="text-content-muted mb-12">{clubStrings.curators.noWork}</p>
      ) : null}

      <PillLink href={routes.app.club.curators()}>{clubStrings.curators.back}</PillLink>
    </>
  )
}

function SectionHeading({
  title,
  href,
  linkLabel,
}: {
  title: string
  href: string
  linkLabel: string
}) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <PillLink href={href} size="sm">
        {linkLabel}
      </PillLink>
    </div>
  )
}

/** Список фактов. Пустой не показывается: заголовок без содержимого — шум */
function FactList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null

  return (
    <div>
      <h2 className="text-content-subtle mb-2 text-xs tracking-wide uppercase">{title}</h2>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item}>
            <Badge variant="outline" size="sm">
              {item}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  )
}
