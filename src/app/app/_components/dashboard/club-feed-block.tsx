import Link from 'next/link'

import { newsStrings } from '@/modules/news'
import { getNewsCards } from '@/modules/news/service'
import { EMPTY_SUMMARY } from '@/modules/reactions'
import { getReactionSummaries } from '@/modules/reactions/service'
import { appConfig } from '@/shared/config/app.config'
import { routes } from '@/shared/routes'

import { getContentViewer } from '../../_lib/viewer'
import { NewsCard } from '../news-card'

/**
 * Новости клуба на главной — то, что раньше читали в главной ветке
 * чата: дайджесты, анонсы, поздравления (ADR-0032).
 *
 * Закреплённый анонс идёт первым, пока не выйдет его срок; дальше —
 * свежие посты. Блок сам решает, показываться ли: пока постов нет,
 * его нет вовсе — пустая рамка на главной сообщала бы ровно ничего.
 */
export async function ClubFeedBlock() {
  const viewer = await getContentViewer('news.edit')
  if (!viewer) return null

  const cards = await getNewsCards(viewer, { limit: appConfig.news.homeLimit })
  if (cards.length === 0) return null

  const reactions = await getReactionSummaries(
    'news_post',
    cards.map((card) => card.id),
    viewer.userId,
  )

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-content-muted text-sm font-semibold tracking-wide uppercase">
          {newsStrings.feedTitle}
        </h2>
        <Link
          href={routes.app.club.news()}
          className="text-content-muted hover:text-content text-sm font-medium"
        >
          {newsStrings.feedAll}
        </Link>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <li key={card.id} className="grid">
            <NewsCard card={card} reactions={reactions[card.id] ?? EMPTY_SUMMARY} compact />
          </li>
        ))}
      </ul>
    </section>
  )
}
