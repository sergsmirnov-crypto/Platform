import type { FavoriteEntity, FavoriteRef, FavoriteRow } from './types'

/**
 * Правила библиотеки — чистые функции без базы и без запроса.
 *
 * Здесь лежит всё, что можно проверить тестом за миллисекунду:
 * разбор вкладки из адреса, отбор, подсчёт. Работа с базой — рядом,
 * в `repository.ts`, и в тестах не участвует.
 */

/**
 * Вкладки на странице отложенного.
 *
 * «Всё» первым и по умолчанию: человек, отложивший семь вещей, не должен
 * разбираться, в какой вкладке лежит нужная. Разделение начинает работать
 * позже, когда отложенного станет несколько десятков.
 */
export const FAVORITE_TABS = ['all', 'song', 'stream', 'lesson'] as const

export type FavoriteTab = (typeof FAVORITE_TABS)[number]

export const DEFAULT_FAVORITE_TAB: FavoriteTab = 'all'

/**
 * Вкладка из адресной строки.
 *
 * Всё непонятное молча превращается в «Всё». Значение приходит из адреса,
 * то есть его может напечатать кто угодно; отвечать на это страницей
 * ошибки — значит наказывать человека за опечатку в ссылке.
 */
export function parseFavoriteTab(raw: string | string[] | undefined): FavoriteTab {
  const value = Array.isArray(raw) ? raw[0] : raw

  return FAVORITE_TABS.find((tab) => tab === value) ?? DEFAULT_FAVORITE_TAB
}

/** Ключ строки: «кто, что, какое» без человека — он и так один */
export function favoriteKey(ref: FavoriteRef): string {
  return `${ref.entityType}:${ref.entityId}`
}

/** Быстрая проверка «отложено ли» для набора строк */
export function toFavoriteKeys(rows: FavoriteRef[]): Set<string> {
  return new Set(rows.map(favoriteKey))
}

/**
 * Отбор по вкладке.
 *
 * Порядок строк не меняется: он задан датой добавления и одинаков
 * во всех вкладках. Пересортировка внутри вкладки означала бы, что одна
 * и та же вещь стоит в разных местах в зависимости от того, откуда
 * человек на неё смотрит.
 */
export function filterByTab<T extends FavoriteRef>(rows: T[], tab: FavoriteTab): T[] {
  if (tab === 'all') return rows

  return rows.filter((row) => row.entityType === tab)
}

/** Сколько отложено каждого вида — для счётчиков на вкладках */
export function countByEntity(rows: FavoriteRef[]): Record<FavoriteEntity, number> {
  const counts: Record<FavoriteEntity, number> = { song: 0, stream: 0, lesson: 0 }

  for (const row of rows) counts[row.entityType] += 1

  return counts
}

/**
 * Достигнут ли предел.
 *
 * Предел существует не ради защиты от злоупотреблений — отложить
 * можно только то, что есть на платформе, а её содержимое ограничено.
 * Он не даёт странице однажды превратиться в список на две тысячи
 * позиций без постраничной навигации.
 */
export function isLimitReached(count: number, limit: number): boolean {
  return count >= limit
}

/**
 * Самое свежее сверху.
 *
 * Сортировка есть и в запросе к базе, но повторена здесь: список
 * иногда собирается из нескольких источников, и порядок обязан быть
 * одним и тем же независимо от того, откуда пришли строки.
 */
export function sortByRecent<T extends FavoriteRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}
