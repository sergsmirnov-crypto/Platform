import 'server-only'

import { and, count, desc, eq, inArray } from 'drizzle-orm'

import { db } from '@/shared/db'

import { favorites } from './schema'

import type { FavoriteEntity, FavoriteRef, FavoriteRow } from './types'

/**
 * Запросы избранного. Единственное место в модуле, где есть SQL.
 */

/**
 * Всё отложенное человеком, свежее сверху.
 *
 * Без постраничной навигации намеренно: список ограничен пределом
 * из настроек, а типичный размер — десятки строк по три поля. Страницы
 * здесь стоили бы дороже, чем экономят, и мешали бы вкладкам —
 * при отборе по виду пришлось бы листать заново.
 */
export async function findFavorites(userId: string): Promise<FavoriteRow[]> {
  return db
    .select({
      entityType: favorites.entityType,
      entityId: favorites.entityId,
      createdAt: favorites.createdAt,
    })
    .from(favorites)
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.createdAt))
}

/** Сколько отложено — для проверки предела перед вставкой */
export async function countFavorites(userId: string): Promise<number> {
  const [result] = await db
    .select({ total: count() })
    .from(favorites)
    .where(eq(favorites.userId, userId))

  return result?.total ?? 0
}

/** Отложен ли конкретный объект */
export async function findFavorite(userId: string, ref: FavoriteRef): Promise<boolean> {
  const rows = await db
    .select({ entityId: favorites.entityId })
    .from(favorites)
    .where(
      and(
        eq(favorites.userId, userId),
        eq(favorites.entityType, ref.entityType),
        eq(favorites.entityId, ref.entityId),
      ),
    )
    .limit(1)

  return rows.length > 0
}

/**
 * Что из набора отложено.
 *
 * Одним запросом на всю страницу: каталог из двадцати четырёх карточек
 * не может позволить себе двадцать четыре обращения к базе. Сегодня
 * кнопка стоит только на страницах объектов, но появится и на карточках —
 * запрос написан сразу так, чтобы этого не пришлось переделывать.
 */
export async function findFavoritesIn(
  userId: string,
  entityType: FavoriteEntity,
  entityIds: string[],
): Promise<Set<string>> {
  if (entityIds.length === 0) return new Set()

  const rows = await db
    .select({ entityId: favorites.entityId })
    .from(favorites)
    .where(
      and(
        eq(favorites.userId, userId),
        eq(favorites.entityType, entityType),
        inArray(favorites.entityId, entityIds),
      ),
    )

  return new Set(rows.map((row) => row.entityId))
}

/**
 * Вставка «отложить».
 *
 * `onConflictDoNothing` вместо проверки «уже отложено?» перед вставкой:
 * два нажатия подряд с телефона и с компьютера иначе дали бы ошибку
 * там, где человек не сделал ничего плохого. Повторное «отложить» —
 * не событие, а то же самое состояние.
 */
export async function insertFavorite(userId: string, ref: FavoriteRef): Promise<void> {
  await db
    .insert(favorites)
    .values({ userId, entityType: ref.entityType, entityId: ref.entityId })
    .onConflictDoNothing()
}

export async function deleteFavorite(userId: string, ref: FavoriteRef): Promise<void> {
  await db
    .delete(favorites)
    .where(
      and(
        eq(favorites.userId, userId),
        eq(favorites.entityType, ref.entityType),
        eq(favorites.entityId, ref.entityId),
      ),
    )
}
