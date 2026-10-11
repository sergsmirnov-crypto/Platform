import 'server-only'

import { and, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/shared/db'
import { hasSearch } from '@/shared/search'
import type { SearchQuery } from '@/shared/search'

import { courseModules, lessons } from './schema'

/** Поиск уроков для общей строки поиска (шаг 10.4) */

export type LessonHit = {
  id: string
  slug: string
  title: string
  moduleSlug: string
  moduleTitle: string
  rank: number
}

/**
 * Урок находится только вместе со своим модулем.
 *
 * Соединение обязательно, а не для красоты: адрес урока состоит
 * из адреса модуля и его собственного, и без модуля ссылку не построить.
 * Заодно отсекаются уроки в неопубликованных модулях — опубликованный
 * урок внутри черновика модуля участнику недоступен.
 */
export async function searchLessonRows(
  query: SearchQuery,
  includeDrafts: boolean,
  limit: number,
): Promise<LessonHit[]> {
  if (!hasSearch(query)) return []

  const rank = sql<number>`ts_rank_cd(${lessons.searchVector}, to_tsquery('russian', ${query.tsquery}))`

  return db
    .select({
      id: lessons.id,
      slug: lessons.slug,
      title: lessons.title,
      moduleSlug: courseModules.slug,
      moduleTitle: courseModules.title,
      rank,
    })
    .from(lessons)
    .innerJoin(courseModules, eq(lessons.moduleId, courseModules.id))
    .where(
      and(
        includeDrafts ? undefined : eq(lessons.status, 'published'),
        includeDrafts ? undefined : eq(courseModules.status, 'published'),
        sql`${lessons.searchVector} @@ to_tsquery('russian', ${query.tsquery})`,
      ),
    )
    .orderBy(desc(rank))
    .limit(limit)
}
