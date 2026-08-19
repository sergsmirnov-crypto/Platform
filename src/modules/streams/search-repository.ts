import 'server-only'

import { and, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/shared/db'
import { hasSearch } from '@/shared/search'
import type { SearchQuery } from '@/shared/search'

import { streams } from './schema'

/** Поиск эфиров для общей строки поиска (шаг 10.4) */

export type StreamHit = {
  id: string
  slug: string
  title: string
  startsAt: Date
  rank: number
}

/**
 * Ищутся и анонсы, и записи.
 *
 * Разделять их здесь не нужно: человек, набравший «блюз», хочет найти
 * эфир про блюз — и завтрашний, и прошлогодний. Что именно нашлось,
 * видно по дате в карточке.
 */
export async function searchStreamRows(
  query: SearchQuery,
  includeDrafts: boolean,
  limit: number,
): Promise<StreamHit[]> {
  if (!hasSearch(query)) return []

  const rank = sql<number>`ts_rank_cd(${streams.searchVector}, to_tsquery('russian', ${query.tsquery}))`

  return db
    .select({
      id: streams.id,
      slug: streams.slug,
      title: streams.title,
      startsAt: streams.startsAt,
      rank,
    })
    .from(streams)
    .where(
      and(
        includeDrafts ? undefined : eq(streams.status, 'published'),
        sql`${streams.searchVector} @@ to_tsquery('russian', ${query.tsquery})`,
      ),
    )
    .orderBy(desc(rank))
    .limit(limit)
}
