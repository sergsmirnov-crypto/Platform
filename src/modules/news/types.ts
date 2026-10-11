import type { ContentBlocks } from '@/shared/blocks'
import type { PublicationStatus } from '@/shared/db/enums'

/** Новость в списке: то, что нужно карточке ленты */
export type NewsCard = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  authorName: string | null
  isPinned: boolean
  publishedAt: Date | null
  /** Черновик — видно только тому, кому позволено */
  isDraft: boolean
}

/** Новость целиком */
export type NewsPostView = NewsCard & {
  content: ContentBlocks
}

/** Новость в списке управления */
export type ManageNewsRow = {
  id: string
  slug: string
  title: string
  status: PublicationStatus
  isPinned: boolean
  publishedAt: Date | null
  updatedAt: Date
  authorName: string | null
}
