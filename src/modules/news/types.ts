import type { ContentBlocks } from '@/shared/blocks'
import type { PublicationStatus } from '@/shared/db/enums'

/**
 * Виды постов — то же, что идёт в главной ветке чата клуба (ADR-0032).
 *
 * Перечень здесь, а не в `schema.ts`: он нужен редактору в браузере,
 * и вместе со схемой туда уехал бы драйвер базы данных.
 */
export const NEWS_KINDS = ['news', 'digest', 'announcement', 'greeting'] as const

export type NewsKind = (typeof NEWS_KINDS)[number]

/** Новость в списке: то, что нужно карточке ленты */
export type NewsCard = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  authorName: string | null
  kind: NewsKind
  /** Закреплён прямо сейчас: признак стоит и срок закрепления не вышел */
  isPinned: boolean
  publishedAt: Date | null
  /** Черновик — видно только тому, кому позволено */
  isDraft: boolean
}

/** Новость целиком */
export type NewsPostView = NewsCard & {
  content: ContentBlocks
  /** Ссылка на обсуждение в Telegram, если куратор её указал */
  discussionUrl: string | null
}

/** Новость в списке управления */
export type ManageNewsRow = {
  id: string
  slug: string
  title: string
  status: PublicationStatus
  kind: NewsKind
  isPinned: boolean
  publishedAt: Date | null
  updatedAt: Date
  authorName: string | null
}
