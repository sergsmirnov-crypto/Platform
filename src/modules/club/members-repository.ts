import 'server-only'

import { and, asc, count, eq, ilike, isNull, or, sql } from 'drizzle-orm'

import { users } from '@/modules/identity/schema'
import { db } from '@/shared/db'

import { curatorProfiles } from './schema'

/**
 * Визитки участников.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗАПРОСЫ ЗДЕСЬ НИКОГДА НЕ ЧИТАЮТ ЗАКРЫТЫЕ ПРОФИЛИ
 *
 * Условие видимости стоит в самом низком слое — в `where`, а не
 * в проверке на стороне страницы. Это единственный способ гарантировать,
 * что закрытый профиль не утечёт: страницу однажды напишут заново,
 * компонент скопируют, поле добавят в выборку «на всякий случай» —
 * а условие в запросе переживёт всё это.
 *
 * Из выборки исключены также поля, которые не показываются никогда:
 * прогресс, подписка, заметки, дата последнего входа. Их здесь просто
 * нет, поэтому показать их невозможно даже по ошибке.
 * ─────────────────────────────────────────────────────────────────
 */

export type MemberRow = {
  id: string
  displayName: string
  avatarId: string | null
  city: string | null
  skillLevel: 'beginner' | 'intermediate' | 'advanced' | null
  playingSince: number | null
  favoriteArtists: string[]
  favoriteGenres: string[]
  bio: string | null
  socials: Record<string, string>
  /** Есть ли у человека карточка куратора — на визитке это отмечено */
  curatorSlug: string | null
}

const columns = {
  id: users.id,
  displayName: users.displayName,
  avatarId: users.avatarId,
  city: users.city,
  skillLevel: users.skillLevel,
  playingSince: users.playingSince,
  favoriteArtists: users.favoriteArtists,
  favoriteGenres: users.favoriteGenres,
  bio: users.bio,
  socials: users.socials,
  curatorSlug: curatorProfiles.slug,
}

/** Единственное определение «видно ли эту визитку» на всю платформу */
function isVisible() {
  return and(isNull(users.deletedAt), eq(users.profileVisibility, 'club'))
}

function baseQuery() {
  return db
    .select(columns)
    .from(users)
    .leftJoin(
      curatorProfiles,
      and(eq(curatorProfiles.userId, users.id), eq(curatorProfiles.isPublic, true)),
    )
}

export async function findMembers(filters: {
  query: string | null
  city: string | null
}): Promise<MemberRow[]> {
  const conditions = [isVisible()]

  if (filters.city) conditions.push(eq(users.city, filters.city))

  if (filters.query) {
    const pattern = `%${filters.query}%`
    // Поиск по имени и городу: «кто ещё из Казани» — самый частый
    // вопрос к такому списку после «кто это вообще»
    conditions.push(or(ilike(users.displayName, pattern), ilike(users.city, pattern)))
  }

  return baseQuery()
    .where(and(...conditions))
    .orderBy(asc(users.displayName))
}

export async function findMemberById(userId: string): Promise<MemberRow | null> {
  const [row] = await baseQuery()
    .where(and(isVisible(), eq(users.id, userId)))
    .limit(1)

  return row ?? null
}

/**
 * Города и сколько в каждом участников.
 *
 * Это и есть обещанная «карта участников» — без точных адресов и точек
 * на карте. Список городов даёт то же ощущение «нас много и мы везде»,
 * не превращая клуб в справочник, где живёт каждый.
 */
export type CityCount = { city: string; count: number }

export async function findCities(): Promise<CityCount[]> {
  const rows = await db
    .select({ city: users.city, count: count(users.id) })
    .from(users)
    .where(and(isVisible(), sql`${users.city} is not null and ${users.city} <> ''`))
    .groupBy(users.city)
    .orderBy(sql`count(${users.id}) desc`, asc(users.city))

  return rows
    .filter((row): row is { city: string; count: number } => row.city !== null)
    .map((row) => ({ city: row.city, count: row.count }))
}

/** Сколько всего открытых визиток — для подписи на странице */
export async function countVisibleMembers(): Promise<number> {
  const [row] = await db
    .select({ total: count(users.id) })
    .from(users)
    .where(isVisible())

  return row?.total ?? 0
}
