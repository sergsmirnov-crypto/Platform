import 'server-only'

import { requirePermission } from '@/modules/access'
import { avatarUrlFor } from '@/modules/identity'
import { errors } from '@/shared/errors'
import type { SearchQuery } from '@/shared/search'
import { slugify } from '@/shared/utils/slug'

import {
  deleteCurator,
  findCandidates,
  findCuratorBySlug,
  findCuratorByUserId,
  findCurators,
  findUserName,
  insertCurator,
  lastOrderIndex,
  slugTaken,
  updateCurator,
  updateCuratorOrder,
  updateCuratorVisibility,
} from './repository'
import { searchCuratorRows } from './search-repository'

import type { CuratorRow } from './repository'
import type { CuratorHit } from './search-repository'
import type { CuratorCard, CuratorView } from './types'

/**
 * Кураторы: чтение для участника и правка для команды.
 *
 * ─────────────────────────────────────────────────────────────────
 * СКРЫТАЯ КАРТОЧКА И ОТСУТСТВУЮЩАЯ — РАЗНЫЕ ВЕЩИ
 *
 * Карточку скрывают, а не удаляют: куратор уходит в отпуск на полгода,
 * его разборы остаются, связь «кто вёл» никуда не девается. Удаление
 * карточки — редкое действие, и оно ничего не делает с содержимым.
 *
 * Участник видит только показанные карточки. Тот, у кого есть право
 * `curators.edit`, видит и скрытые — с пометкой, ровно как черновики
 * разборов.
 * ─────────────────────────────────────────────────────────────────
 */

/** Кто смотрит: от этого зависит, видны ли скрытые карточки */
export type CuratorViewer = { userId: string; canSeeHidden: boolean }

export async function getCurators(viewer: CuratorViewer): Promise<CuratorCard[]> {
  const rows = await findCurators(viewer.canSeeHidden)

  return rows.map(toCard)
}

export async function getCuratorBySlug(
  viewer: CuratorViewer,
  slug: string,
): Promise<CuratorView | null> {
  const row = await findCuratorBySlug(slug, viewer.canSeeHidden)

  return row ? toView(row) : null
}

/**
 * Кого можно сделать куратором.
 *
 * Право `curators.edit` со степенью `all`: список участников — не то,
 * что показывают всякому, у кого есть доступ к своей карточке.
 */
export async function getCuratorCandidates(
  actorId: string,
  query: string,
): Promise<{ id: string; displayName: string; avatarId: string | null }[]> {
  await requirePermission(actorId, 'curators.edit', null)

  if (query.trim().length < 2) return []

  return findCandidates(query.trim())
}

/** Своя карточка — для кнопки «Редактировать» на странице куратора */
export async function getOwnCurator(userId: string): Promise<CuratorView | null> {
  const row = await findCuratorByUserId(userId)

  return row ? toView(row) : null
}

/**
 * Заведение карточки.
 *
 * Право `curators.edit` со степенью `all`: карточку человеку заводит
 * старший куратор, а дальше человек правит её сам. Обратный порядок
 * («каждый заводит себе карточку») превратил бы страницу «Кураторы»
 * в список всех, кто захотел.
 */
export async function createCuratorCard(actorId: string, userId: string): Promise<void> {
  await requirePermission(actorId, 'curators.edit', null)

  const existing = await findCuratorByUserId(userId)
  if (existing) throw errors.validation({ userId: 'У этого участника уже есть карточка' })

  await insertCurator({
    userId,
    slug: await freeSlug(userId),
    orderIndex: await lastOrderIndex(),
  })
}

export async function editCuratorCard(
  actorId: string,
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
  // Область прав здесь работает буквально: `own` — свою карточку,
  // `all` — любую. Это единственное место на платформе, где «свой»
  // означает «про меня самого», а не «мной созданный»
  await requirePermission(actorId, 'curators.edit', userId)

  const card = await findCuratorByUserId(userId)
  if (!card) throw errors.notFound('Карточка куратора не найдена')

  await updateCurator(userId, values)
}

export async function setCuratorPublic(
  actorId: string,
  userId: string,
  isPublic: boolean,
): Promise<void> {
  await requirePermission(actorId, 'curators.edit', userId)
  await updateCuratorVisibility(userId, isPublic)
}

/** Порядок карточек — только у того, кто правит все */
export async function reorderCurators(actorId: string, userIds: string[]): Promise<void> {
  await requirePermission(actorId, 'curators.edit', null)
  await updateCuratorOrder(userIds.map((userId, orderIndex) => ({ userId, orderIndex })))
}

export async function removeCuratorCard(actorId: string, userId: string): Promise<void> {
  await requirePermission(actorId, 'curators.edit', null)
  await deleteCurator(userId)
}

function toCard(row: CuratorRow): CuratorCard {
  return {
    userId: row.userId,
    slug: row.slug,
    displayName: row.displayName,
    avatarUrl: avatarUrlFor(row.userId, row.avatarId, 'sm'),
    headline: row.headline,
    city: row.city,
    teaches: row.teaches,
    teachingYears: teachingYears(row.teachingSince),
    isPublic: row.isPublic,
  }
}

function toView(row: CuratorRow): CuratorView {
  return {
    ...toCard(row),
    // На своей странице фотография крупная — размер другой
    avatarUrl: avatarUrlFor(row.userId, row.avatarId, 'lg'),
    bio: row.bio,
    influences: row.influences,
    gear: row.gear,
    favoriteGenres: row.favoriteGenres,
    socials: row.socials,
    teachingSince: row.teachingSince,
    orderIndex: row.orderIndex,
  }
}

/**
 * Стаж считается от года, а не хранится числом.
 *
 * Записанное число «двенадцать лет» устаревает молча и через год врёт.
 * Год начала не устаревает никогда.
 */
function teachingYears(since: number | null): number | null {
  if (!since) return null

  const years = new Date().getFullYear() - since

  return years > 0 ? years : null
}

/**
 * Адресное имя из имени участника.
 *
 * Собирается один раз при заведении карточки и потом не меняется:
 * ссылку на страницу куратора кидают в чат клуба, и она не должна
 * ломаться от того, что человек поправил имя в профиле.
 */
async function freeSlug(userId: string): Promise<string> {
  const displayName = await findUserName(userId)
  const base = slugify(displayName ?? '') || `curator-${Date.now()}`

  if (!(await slugTaken(base, userId))) return base

  for (let suffix = 2; suffix <= 20; suffix += 1) {
    const candidate = `${base}-${suffix}`
    if (!(await slugTaken(candidate, userId))) return candidate
  }

  return `${base}-${Date.now()}`
}

/**
 * Кураторы, подходящие под запрос общей строки поиска (шаг 10.4).
 *
 * Читатель не нужен: скрытые карточки не находятся ни у кого, включая
 * администратора. Спрятанное должно оставаться спрятанным.
 */
export async function searchCurators(query: SearchQuery, limit: number): Promise<CuratorHit[]> {
  return searchCuratorRows(query, limit)
}
