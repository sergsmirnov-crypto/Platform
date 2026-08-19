import 'server-only'

import { and, eq, ilike, or } from 'drizzle-orm'

import { users } from '@/modules/identity/schema'
import { db } from '@/shared/db'
import type { SearchQuery } from '@/shared/search'

import { curatorProfiles } from './schema'

/**
 * Поиск кураторов для общей строки поиска (шаг 10.4).
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗДЕСЬ ПРОСТОЕ СОВПАДЕНИЕ ПО ПОДСТРОКЕ, А НЕ ПОЛНОТЕКСТОВЫЙ ПОИСК
 *
 * Кураторов трое. Поисковый вектор, индекс и ранжирование ради трёх
 * строк — это работа, которая никогда себя не окупит, и лишняя колонка
 * в таблице, которую придётся объяснять следующему разработчику.
 *
 * Совпадение по подстроке ищется по всем вариантам запроса сразу —
 * включая исправленную раскладку и транслитерацию, — поэтому «Иванов»,
 * набранное латиницей, всё равно находится.
 * ─────────────────────────────────────────────────────────────────
 */

export type CuratorHit = {
  slug: string
  displayName: string
  headline: string | null
}

export async function searchCuratorRows(query: SearchQuery, limit: number): Promise<CuratorHit[]> {
  if (query.variants.length === 0) return []

  const patterns = query.variants.map((variant) => `%${variant}%`)

  return db
    .select({
      slug: curatorProfiles.slug,
      displayName: users.displayName,
      headline: curatorProfiles.headline,
    })
    .from(curatorProfiles)
    .innerJoin(users, eq(curatorProfiles.userId, users.id))
    .where(
      and(
        // Скрытые карточки не находятся: спрятанное должно оставаться
        // спрятанным, в том числе от поиска
        eq(curatorProfiles.isPublic, true),
        or(
          ...patterns.map((pattern) => ilike(users.displayName, pattern)),
          ...patterns.map((pattern) => ilike(curatorProfiles.headline, pattern)),
        ),
      ),
    )
    .limit(limit)
}
