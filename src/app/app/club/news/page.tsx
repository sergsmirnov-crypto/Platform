import Link from 'next/link'

import { newsStrings } from '@/modules/news'
import { getNewsCards } from '@/modules/news/service'
import { routes } from '@/shared/routes'
import { Badge, EmptyState } from '@/ui'

import { PageIntro } from '../../_components/page-intro'
import { getContentViewer } from '../../_lib/viewer'

export const metadata = { title: newsStrings.title }

/**
 * Лента новостей клуба.
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
 * Кода в браузере здесь нет: карточка — обычная ссылка.
 */
export default async function NewsPage() {
  const viewer = await getContentViewer('news.edit')
  if (!viewer) return null

  const cards = await getNewsCards(viewer)

  return (
    <>
      <PageIntro title={newsStrings.title} description={newsStrings.description} />

      {cards.length > 0 ? (
        <ul className="space-y-3">
          {cards.map((card) => (
            <li key={card.id}>
              <Link
                href={routes.app.club.newsPost(card.slug)}
                className="border-border hover:border-border-strong block rounded-xl border p-5 transition-colors"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  {card.isPinned ? (
                    <Badge variant="outline" size="sm">
                      {newsStrings.pinned}
                    </Badge>
                  ) : null}
                  {card.isDraft ? (
                    <Badge variant="draft" size="sm">
                      {newsStrings.draft}
                    </Badge>
                  ) : null}
                  <span className="text-content-muted text-sm">{formatDate(card.publishedAt)}</span>
                </div>

                <span className="font-display block text-lg font-bold">{card.title}</span>

                {card.excerpt ? (
                  <span className="text-content-muted mt-1 block">{card.excerpt}</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={newsStrings.empty}
          description={newsStrings.emptyDescription}
          className="border-border rounded-lg border border-dashed"
        />
      )}
    </>
  )
}

/** Неопубликованная новость даты не имеет — и не должна её выдумывать */
function formatDate(date: Date | null): string {
  if (!date) return ''

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}
