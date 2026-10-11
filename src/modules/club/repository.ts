import 'server-only'

import { and, asc, eq, ilike, isNull } from 'drizzle-orm'

import { users } from '@/modules/identity/schema'
import { db } from '@/shared/db'

import { curatorProfiles } from './schema'

/**
 * Запросы модуля клуба.
 *
 * Единственное место, где есть SQL. Карточка куратора всегда читается
 * вместе с участником: показывать её без имени и фотографии
 * бессмысленно, а два запроса вместо одного соединения — это
 * та самая мелочь, из которой потом складывается медленная страница.
 */

export type CuratorRow = {
  userId: string
  slug: string
  headline: string | null
  bio: string | null
  teaches: string[]
  influences: string[]
  gear: string[]
  teachingSince: number | null
  isPublic: boolean
  orderIndex: number
  displayName: string
  avatarId: string | null
  city: string | null
  favoriteGenres: string[]
  socials: Record<string, string>
}

const columns = {
  userId: curatorProfiles.userId,
  slug: curatorProfiles.slug,
  headline: curatorProfiles.headline,
  bio: curatorProfiles.bio,
  teaches: curatorProfiles.teaches,
  influences: curatorProfiles.influences,
  gear: curatorProfiles.gear,
  teachingSince: curatorProfiles.teachingSince,
  isPublic: curatorProfiles.isPublic,
  orderIndex: curatorProfiles.orderIndex,
  displayName: users.displayName,
  avatarId: users.avatarId,
  city: users.city,
  favoriteGenres: users.favoriteGenres,
  socials: users.socials,
}

function baseQuery() {
  return db.select(columns).from(curatorProfiles).innerJoin(users, eq(users.id, curatorProfiles.userId)) // prettier-ignore
}

/**
 * Список карточек.
 *
 * Удалённые участники не показываются: человек ушёл из клуба, его
 * карточка исчезает со страницы, но строка остаётся — иначе рассыпались
 * бы связи «кто вёл этот разбор».
 */
export async function findCurators(includeHidden: boolean): Promise<CuratorRow[]> {
  return baseQuery()
    .where(includeHidden ? isAlive() : and(isAlive(), eq(curatorProfiles.isPublic, true)))
    .orderBy(asc(curatorProfiles.orderIndex), asc(users.displayName))
}

export async function findCuratorBySlug(
  slug: string,
  includeHidden: boolean,
): Promise<CuratorRow | null> {
  const [row] = await baseQuery()
    .where(
      includeHidden
        ? and(isAlive(), eq(curatorProfiles.slug, slug))
        : and(isAlive(), eq(curatorProfiles.slug, slug), eq(curatorProfiles.isPublic, true)),
    )
    .limit(1)

  return row ?? null
}

/** Карточка по участнику — редактору нужно именно так */
export async function findCuratorByUserId(userId: string): Promise<CuratorRow | null> {
  const [row] = await baseQuery().where(eq(curatorProfiles.userId, userId)).limit(1)

  return row ?? null
}

export async function insertCurator(input: {
  userId: string
  slug: string
  orderIndex: number
}): Promise<void> {
  await db.insert(curatorProfiles).values(input)
}

export async function updateCurator(
  userId: string,
  values: {
    headline: string | null
    bio: string | null
    teaches: string[]
    influences: string[]
    gear: string[]
    teachingSince: number | null
  },
): Promise<void> {
  await db
    .update(curatorProfiles)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(curatorProfiles.userId, userId))
}

export async function updateCuratorVisibility(userId: string, isPublic: boolean): Promise<void> {
  await db
    .update(curatorProfiles)
    .set({ isPublic, updatedAt: new Date() })
    .where(eq(curatorProfiles.userId, userId))
}

export async function updateCuratorOrder(
  order: { userId: string; orderIndex: number }[],
): Promise<void> {
  // prettier-ignore
  for (const item of order) {
    await db
      .update(curatorProfiles)
      .set({ orderIndex: item.orderIndex, updatedAt: new Date() })
      .where(eq(curatorProfiles.userId, item.userId))
  }
}

export async function deleteCurator(userId: string): Promise<void> {
  await db.delete(curatorProfiles).where(eq(curatorProfiles.userId, userId))
}

/** Занято ли адресное имя другой карточкой */
export async function slugTaken(slug: string, exceptUserId: string | null): Promise<boolean> {
  const [row] = await db
    .select({ userId: curatorProfiles.userId })
    .from(curatorProfiles)
    .where(eq(curatorProfiles.slug, slug))
    .limit(1)

  return row !== undefined && row.userId !== exceptUserId
}

/**
 * Участники, которым можно завести карточку.
 *
 * Поиск по имени среди тех, у кого карточки ещё нет: заводить вторую
 * тому, у кого она есть, незачем, а список всех ста пятидесяти участников
 * в выпадающем поле бесполезен.
 */
export async function findCandidates(
  query: string,
  limit = 10,
): Promise<{ id: string; displayName: string; avatarId: string | null }[]> {
  // prettier-ignore
  const pattern = `%${query}%`

  return db
    .select({ id: users.id, displayName: users.displayName, avatarId: users.avatarId })
    .from(users)
    .leftJoin(curatorProfiles, eq(curatorProfiles.userId, users.id))
    .where(
      and(
        isNull(users.deletedAt),
        isNull(curatorProfiles.userId),
        ilike(users.displayName, pattern),
      ),
    ) // prettier-ignore
    .orderBy(asc(users.displayName))
    .limit(limit)
}

/** Имя участника — нужно, чтобы собрать адресное имя новой карточки */
export async function findUserName(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ displayName: users.displayName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return row?.displayName ?? null
}

/** Наибольший порядковый номер — чтобы новая карточка встала в конец */
export async function lastOrderIndex(): Promise<number> {
  const rows = await db
    .select({ orderIndex: curatorProfiles.orderIndex })
    .from(curatorProfiles)
    .orderBy(asc(curatorProfiles.orderIndex))

  return rows.length === 0 ? 0 : (rows[rows.length - 1]?.orderIndex ?? 0) + 1
}

/** Удалённый участник со страницы исчезает, а его контент остаётся */
function isAlive() {
  return isNull(users.deletedAt)
}
