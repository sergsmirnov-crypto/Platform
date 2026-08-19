import { Radio } from 'lucide-react'
import Link from 'next/link'

import { getProgressMap } from '@/modules/progress/service'
import { hasArchiveFilters, parseArchiveFilters, searchTerms, streamStrings } from '@/modules/streams' // prettier-ignore
import type { RawSearchParams } from '@/modules/streams'
import { getNextStream, getStreamArchive, getStreamCurators } from '@/modules/streams/service'
import { routes } from '@/shared/routes'
import { EmptyState, LinkButton } from '@/ui'

import { PageIntro } from '../_components/page-intro'
import { getContentViewer } from '../_lib/viewer'

import { ArchiveNav } from './_components/archive-nav'
import { ArchiveToolbar } from './_components/archive-toolbar'
import { StreamCardItem } from './_components/stream-card'

export const metadata = { title: 'Эфиры' }

/**
 * Архив записей.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ АРХИВ — ГЛАВНАЯ СТРАНИЦА РАЗДЕЛА, А НЕ АНОНСЫ
 *
 * Эфир проходит раз в неделю, а записей сорок. Девять из десяти
 * заходов сюда — это «посмотреть то, что пропустил», а не «узнать,
 * когда следующий». Поэтому анонсы вынесены на отдельную страницу,
 * а идущий прямо сейчас эфир поднимается сюда полосой: пропустить
 * его из-за расположения списков было бы обидно.
 * ─────────────────────────────────────────────────────────────────
 *
 * Собирается на сервере целиком. Кода в браузере — только строка
 * поиска и подсказка о местном времени.
 */
export default async function StreamsArchivePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  const viewer = await getContentViewer('streams.view_drafts')
  if (!viewer) return null

  const filters = parseArchiveFilters(await searchParams)

  const [archive, curators, next] = await Promise.all([
    getStreamArchive(viewer, filters),
    getStreamCurators(viewer),
    getNextStream(viewer),
  ])

  // Прогресс спрашивается одним запросом на всю страницу и только
  // для показанных записей: полоса просмотра на карточке не стоит
  // отдельного обращения к базе на каждую строку
  const progress = await getProgressMap(
    viewer.userId,
    'stream',
    archive.items.map((item) => item.id),
  )

  const terms = searchTerms(filters.query)

  return (
    <>
      <PageIntro
        title={streamStrings.title}
        description={streamStrings.list.archiveHint}
        actions={
          <LinkButton href={routes.app.streams.upcoming()} variant="secondary" size="sm">
            {streamStrings.list.allUpcoming}
          </LinkButton>
        }
      />

      {next?.phase === 'live' ? <LiveStrip slug={next.slug} title={next.title} /> : null}

      <ArchiveToolbar filters={filters} total={archive.total} curators={curators} />

      {archive.items.length === 0 ? (
        <ArchiveEmpty query={filters.query} hasFilters={hasArchiveFilters(filters)} />
      ) : (
        <ul className="space-y-3">
          {archive.items.map((stream) => (
            <li key={stream.id}>
              <StreamCardItem
                stream={stream}
                terms={terms}
                watchedPercent={progress.get(stream.id)?.percent ?? 0}
              />
            </li>
          ))}
        </ul>
      )}

      <ArchiveNav filters={filters} page={archive.page} pageCount={archive.pageCount} />
    </>
  )
}

/**
 * Полоса «идёт прямо сейчас».
 *
 * Появляется, только пока эфир действительно идёт. Это единственное
 * на платформе, что нельзя посмотреть позже, поэтому оно и вынесено
 * наверх — в остальное время строки нет вовсе.
 */
function LiveStrip({ slug, title }: { slug: string; title: string }) {
  return (
    <Link
      href={routes.app.streams.stream(slug)}
      className="bg-danger text-danger-content mb-6 flex items-center gap-3 rounded-xl px-5 py-4 font-medium"
    >
      <span className="relative flex size-3 shrink-0" aria-hidden>
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
        <span className="relative inline-flex size-3 rounded-full bg-current" />
      </span>

      <span className="min-w-0 flex-1 truncate">
        {streamStrings.list.liveNow} — {title}
      </span>

      <Radio size={18} aria-hidden className="shrink-0" />
    </Link>
  )
}

/**
 * Пустой архив.
 *
 * Две разные пустоты, и путать их нельзя: «ничего не нашлось» лечится
 * сбросом фильтров, «записей ещё нет» — не лечится. Одинаковое
 * сообщение заставило бы человека искать несуществующую кнопку.
 */
function ArchiveEmpty({ query, hasFilters }: { query: string | null; hasFilters: boolean }) {
  if (hasFilters) {
    return (
      <EmptyState
        title={query ? streamStrings.list.notFound(query) : streamStrings.list.empty}
        description={streamStrings.list.notFoundHint}
        action={
          <LinkButton href={routes.app.streams.index()} variant="secondary">
            {streamStrings.list.reset}
          </LinkButton>
        }
        className="border-border rounded-lg border border-dashed"
      />
    )
  }

  return (
    <EmptyState
      title={streamStrings.list.empty}
      description={streamStrings.list.emptyHint}
      action={
        <LinkButton href={routes.app.streams.upcoming()} variant="secondary">
          {streamStrings.list.allUpcoming}
        </LinkButton>
      }
      className="border-border rounded-lg border border-dashed"
    />
  )
}
