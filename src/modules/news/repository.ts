import 'server-only'

import { and, asc, desc, eq, sql } from 'drizzle-orm'

import { users } from '@/modules/identity/schema'
import { db } from '@/shared/db'
import { hasSearch } from '@/shared/search'
import type { SearchQuery } from '@/shared/search'

import { newsPosts } from './schema'

/**
 * Запросы новостей. Единственное место модуля, где есть SQL.
 */

const CARD_FIELDS = {
  id: newsPosts.id,
  slug: newsPosts.slug,
  title: newsPosts.title,
  excerpt: newsPosts.excerpt,
  authorName: users.displayName,
  isPinned: newsPosts.isPinned,
  publishedAt: newsPosts.publishedAt,
  status: newsPosts.status,
}

function visible(includeDrafts: boolean) {
  return includeDrafts ? undefined : eq(newsPosts.status, 'published')
}

/**
 * Лента: закреплённые сверху, дальше по дате.
 *
 * Порядок задан одним индексом и не настраивается: у ленты новостей
 * не бывает «сортировки по алфавиту».
 */
export async function findNewsCards(includeDrafts: boolean, limit: number) {
  return db
    .select(CARD_FIELDS)
    .from(newsPosts)
    .leftJoin(users, eq(newsPosts.authorId, users.id))
    .where(visible(includeDrafts))
    .orderBy(desc(newsPosts.isPinned), desc(newsPosts.publishedAt), desc(newsPosts.createdAt))
    .limit(limit)
}

export async function findNewsBySlug(slug: string, includeDrafts: boolean) {
  const [row] = await db
    .select({ ...CARD_FIELDS, content: newsPosts.content })
    .from(newsPosts)
    .leftJoin(users, eq(newsPosts.authorId, users.id))
    .where(and(eq(newsPosts.slug, slug), visible(includeDrafts)))
    .limit(1)

  return row ?? null
}

/** Список для управления: все статусы, свежие правки сверху */
export async function findNewsForManage() {
  return db
    .select({
      id: newsPosts.id,
      slug: newsPosts.slug,
      title: newsPosts.title,
      status: newsPosts.status,
      isPinned: newsPosts.isPinned,
      publishedAt: newsPosts.publishedAt,
      updatedAt: newsPosts.updatedAt,
      authorName: users.displayName,
    })
    .from(newsPosts)
    .leftJoin(users, eq(newsPosts.authorId, users.id))
    .orderBy(desc(newsPosts.updatedAt))
}

export async function findNewsById(id: string) {
  const [row] = await db.select().from(newsPosts).where(eq(newsPosts.id, id)).limit(1)

  return row ?? null
}

/** Занят ли адрес кем-то другим */
export async function isSlugTaken(slug: string, exceptId: string | null): Promise<boolean> {
  const rows = await db
    .select({ id: newsPosts.id })
    .from(newsPosts)
    .where(eq(newsPosts.slug, slug))
    .limit(1)

  const found = rows[0]

  return found !== undefined && found.id !== exceptId
}

export async function insertNews(input: {
  slug: string
  title: string
  authorId: string
  createdBy: string
}): Promise<string> {
  const [row] = await db
    .insert(newsPosts)
    .values({ ...input, status: 'draft' })
    .returning({ id: newsPosts.id })

  if (!row) throw new Error('Новость не создалась')

  return row.id
}

export async function updateNews(
  id: string,
  patch: {
    slug?: string
    title?: string
    excerpt?: string | null
    content?: unknown
    isPinned?: boolean
  },
): Promise<void> {
  await db
    .update(newsPosts)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(newsPosts.id, id))
}

/**
 * Публикация и снятие.
 *
 * Дата публикации ставится один раз, при первой публикации, и дальше
 * не трогается: снятая и возвращённая новость не должна прыгать
 * наверх ленты как новая.
 */
export async function setNewsPublished(id: string, published: boolean): Promise<void> {
  await db
    .update(newsPosts)
    .set({
      status: published ? 'published' : 'draft',
      publishedAt: published
        ? sql`coalesce(${newsPosts.publishedAt}, now())`
        : newsPosts.publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(newsPosts.id, id))
}

export async function deleteNews(id: string): Promise<void> {
  await db.delete(newsPosts).where(eq(newsPosts.id, id))
}

/** Поиск новостей для общей строки поиска */
export async function searchNewsRows(query: SearchQuery, includeDrafts: boolean, limit: number) {
  if (!hasSearch(query)) return []

  const rank = sql<number>`ts_rank_cd(${newsPosts.searchVector}, to_tsquery('russian', ${query.tsquery}))`

  return db
    .select({
      id: newsPosts.id,
      slug: newsPosts.slug,
      title: newsPosts.title,
      publishedAt: newsPosts.publishedAt,
      rank,
    })
    .from(newsPosts)
    .where(
      and(
        visible(includeDrafts),
        sql`${newsPosts.searchVector} @@ to_tsquery('russian', ${query.tsquery})`,
      ),
    )
    .orderBy(desc(rank), asc(newsPosts.title))
    .limit(limit)
}
