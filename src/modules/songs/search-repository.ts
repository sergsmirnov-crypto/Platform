import 'server-only'

import { and, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/shared/db'
import { hasSearch } from '@/shared/search'
import type { SearchQuery } from '@/shared/search'

import { songs } from './schema'

/**
 * Поиск разборов для общей строки поиска (шаг 10.4).
 *
 * Отдельно от каталожного запроса, хотя оба ищут по одному вектору.
 * Каталогу нужны фильтры, постраничная навигация, уровни, метки
 * и обложки; общему поиску — название, исполнитель и адрес, зато
 * из четырёх разделов сразу и быстро.
 *
 * Сведение этих двух запросов в один дало бы функцию с восемью
 * необязательными аргументами, половина из которых всегда `undefined`.
 */

export type SongHit = {
  id: string
  slug: string
  title: string
  artist: string
  rank: number
}

export async function searchSongRows(
  query: SearchQuery,
  includeDrafts: boolean,
  limit: number,
): Promise<SongHit[]> {
  if (!hasSearch(query)) return []

  const rank = sql<number>`ts_rank_cd(${songs.searchVector}, to_tsquery('russian', ${query.tsquery}))`

  return db
    .select({
      id: songs.id,
      slug: songs.slug,
      title: songs.title,
      artist: songs.artist,
      rank,
    })
    .from(songs)
    .where(
      and(
        includeDrafts ? undefined : eq(songs.status, 'published'),
        sql`${songs.searchVector} @@ to_tsquery('russian', ${query.tsquery})`,
      ),
    )
    .orderBy(desc(rank))
    .limit(limit)
}
