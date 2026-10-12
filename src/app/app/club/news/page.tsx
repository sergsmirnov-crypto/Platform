import Link from 'next/link'

import { NEWS_KINDS, newsStrings, parseNewsKind } from '@/modules/news'
import type { NewsKind } from '@/modules/news'
import { getNewsCards } from '@/modules/news/service'
import { EMPTY_SUMMARY } from '@/modules/reactions'
import { getReactionSummaries } from '@/modules/reactions/service'
import { routes } from '@/shared/routes'
import { cn, EmptyState } from '@/ui'

import { NewsCard } from '../../_components/news-card'
import { PageIntro } from '../../_components/page-intro'
import { getContentViewer } from '../../_lib/viewer'

export const metadata = { title: newsStrings.title }

type Props = { searchParams: Promise<{ kind?: string }> }

/**
 * Лента новостей клуба — то же, что главная ветка чата: дайджесты,
 * анонсы, поздравления, новости (ADR-0032).
 *
 * ─────────────────────────────────────────────────────────────────
 * ЧЕРНОВИКИ ВИДИТ ТОТ, КТО МОЖЕТ ПРАВИТЬ
 *
 * Отдельного права «видеть черновики новостей» в каталоге нет —
 * в отличие от разборов, эфиров и курса. Заводить его ради раздела,
 * который ведут те же три человека, значило бы плодить настройку,
 * которую никто никогда не тронет.
 *
 * Поэтому признак берётся у права `news.edit`: кто пишет новости,
 * тот и видит неопубликованные.
 * ─────────────────────────────────────────────────────────────────
 *
 * Фильтр по виду — ссылками в адресной строке, а не кодом в браузере:
 * им можно поделиться («все анонсы»), и он работает без JavaScript.
 * Реакции здесь только видны; ставят их на странице поста.
 */
export default async function NewsPage({ searchParams }: Props) {
  const viewer = await getContentViewer('news.edit')
  if (!viewer) return null

  const kind = parseNewsKind((await searchParams).kind)
  const cards = await getNewsCards(viewer, { kind })
  const reactions = await getReactionSummaries(
    'news_post',
    cards.map((card) => card.id),
    viewer.userId,
  )

  return (
    <>
      <PageIntro title={newsStrings.title} description={newsStrings.description} />

      <nav aria-label="Вид постов" className="mb-6 flex flex-wrap gap-2">
        <KindLink kind={null} current={kind} />
        {NEWS_KINDS.map((option) => (
          <KindLink key={option} kind={option} current={kind} />
        ))}
      </nav>

      {cards.length > 0 ? (
        <ul className="space-y-3">
          {cards.map((card) => (
            <li key={card.id}>
              <NewsCard card={card} reactions={reactions[card.id] ?? EMPTY_SUMMARY} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={kind ? newsStrings.emptyKind : newsStrings.empty}
          description={newsStrings.emptyDescription}
          className="border-border rounded-lg border border-dashed"
        />
      )}
    </>
  )
}

function KindLink({ kind, current }: { kind: NewsKind | null; current: NewsKind | null }) {
  const isActive = kind === current
  const href = kind ? `${routes.app.club.news()}?kind=${kind}` : routes.app.club.news()

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex min-h-10 items-center rounded-full border px-4 text-sm transition-colors',
        isActive
          ? 'border-accent bg-accent text-accent-content'
          : 'border-border text-content-muted hover:border-border-strong',
      )}
    >
      {kind ? newsStrings.kindFilters[kind] : newsStrings.allKinds}
    </Link>
  )
}
