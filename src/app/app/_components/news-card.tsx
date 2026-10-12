import Link from 'next/link'

import { newsStrings } from '@/modules/news'
import type { NewsCard as NewsCardData } from '@/modules/news'
import type { ReactionSummary } from '@/modules/reactions'
import { routes } from '@/shared/routes'
import { Badge, cn } from '@/ui'

import { ReactionPreview } from './reactions/reaction-preview'

/**
 * Карточка поста — одна для ленты новостей и для блока на главной.
 *
 * Две копии разошлись бы при первой же правке: метка вида появилась бы
 * в ленте и забылась на главной. Карточка целиком — ссылка, кода
 * в браузере нет.
 */

type NewsCardProps = {
  card: NewsCardData
  reactions: ReactionSummary
  /** Компактная — для главной: без выжимки длиннее двух строк */
  compact?: boolean
}

export function NewsCard({ card, reactions, compact = false }: NewsCardProps) {
  return (
    <Link
      href={routes.app.club.newsPost(card.slug)}
      className={cn(
        'border-border hover:border-border-strong block rounded-xl border transition-colors',
        compact ? 'p-4' : 'p-5',
        card.isPinned && 'border-accent',
      )}
    >
      <span className="mb-1 flex flex-wrap items-center gap-2">
        <Badge variant="outline" size="sm">
          {newsStrings.kinds[card.kind]}
        </Badge>
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
      </span>

      <span className={cn('font-display block font-bold', compact ? 'text-base' : 'text-lg')}>
        {card.title}
      </span>

      {card.excerpt ? (
        <span className={cn('text-content-muted mt-1 block', compact && 'line-clamp-2 text-sm')}>
          {card.excerpt}
        </span>
      ) : null}

      {reactions.total > 0 ? (
        <span className="mt-3 block">
          <ReactionPreview summary={reactions} />
        </span>
      ) : null}
    </Link>
  )
}

/** Неопубликованная новость даты не имеет — и не должна её выдумывать */
function formatDate(date: Date | null): string {
  if (!date) return ''

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Moscow',
  }).format(date)
}
