import 'server-only'

import { appConfig } from '@/shared/config/app.config'
import { errors } from '@/shared/errors'

import {
  countFavorites,
  deleteFavorite,
  findFavorite,
  findFavorites,
  findFavoritesIn,
  insertFavorite,
} from './repository'
import { isLimitReached } from './rules'
import { libraryStrings } from './strings'

import type { FavoriteEntity, FavoriteRef, FavoriteRow } from './types'

/**
 * Чтение и запись избранного.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПРАВ ЗДЕСЬ НЕ ПРОВЕРЯЕМ, И ЭТО НЕ УПУЩЕНИЕ
 *
 * Избранное всегда своё: идентификатор человека берётся из сессии,
 * а не из запроса. Отложить что-то другому человеку невозможно —
 * для этого пришлось бы прислать чужой идентификатор, а его никто
 * не спрашивает. То же рассуждение, что у прогресса.
 *
 * Чего этот модуль сделать не может — проверить, что откладываемое
 * вообще существует и видно этому человеку. Для этого нужно знать
 * про разборы, эфиры и курс, а модулю библиотеки о них знать нельзя.
 * Проверка живёт в слое приложения, в `app/app/_actions/favorites.ts`,
 * — там же, где собирается и сам список.
 * ─────────────────────────────────────────────────────────────────
 */

/** Всё отложенное, свежее сверху */
export async function listFavorites(userId: string): Promise<FavoriteRow[]> {
  return findFavorites(userId)
}

/** Сколько всего отложено — для счётчика в личном кабинете */
export async function getFavoriteCount(userId: string): Promise<number> {
  return countFavorites(userId)
}

/** Отложен ли объект — для состояния кнопки на его странице */
export async function isFavorite(userId: string, ref: FavoriteRef): Promise<boolean> {
  return findFavorite(userId, ref)
}

/** Что из набора отложено — для списков и каталога */
export async function getFavoriteIds(
  userId: string,
  entityType: FavoriteEntity,
  entityIds: string[],
): Promise<Set<string>> {
  return findFavoritesIn(userId, entityType, entityIds)
}

/**
 * Отложить или убрать.
 *
 * Одна функция на оба действия, а не две: нажимают одну и ту же кнопку,
 * и требуемое состояние приходит от неё готовым. Отдельные «добавить»
 * и «убрать» заставляли бы интерфейс сначала спрашивать текущее
 * состояние, а между вопросом и ответом оно успевает измениться —
 * с двух устройств это даёт кнопку, которая «не нажимается».
 *
 * @param desired какое состояние должно получиться: `true` — отложено
 */
export async function setFavorite(
  userId: string,
  ref: FavoriteRef,
  desired: boolean,
): Promise<{ favorite: boolean }> {
  if (!desired) {
    await deleteFavorite(userId, ref)
    return { favorite: false }
  }

  // Предел проверяем только при добавлении: упереться в него, убирая
  // лишнее, — это ловушка, из которой человеку не выбраться
  const total = await countFavorites(userId)
  if (isLimitReached(total, appConfig.library.maxFavorites)) {
    throw errors.conflict(libraryStrings.limit.reached)
  }

  await insertFavorite(userId, ref)
  return { favorite: true }
}
