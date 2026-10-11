import 'server-only'

import { avatarUrlFor } from '@/modules/identity'
import { hasActiveAccess } from '@/modules/subscription'

import { countVisibleMembers, findCities, findMemberById, findMembers } from './members-repository'

import type { CityCount, MemberRow } from './members-repository'
import type { MemberCard, MemberView } from './types'

/**
 * Визитки участников.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗАКРЫТЫЙ ПРОФИЛЬ НЕ ЛИШАЕТ ПРАВА СМОТРЕТЬ
 *
 * Решение владельца продукта: человек с закрытой визиткой видит чужие
 * открытые. Взаимность («показываешь свою — видишь чужие») выглядит
 * справедливее, но на деле это давление: чтобы просто посмотреть,
 * кто в клубе, пришлось бы раскрыться самому.
 *
 * Условие видимости при этом одно и живёт в запросе: закрытый профиль
 * не показывается никому, включая тех, кто открыт.
 * ─────────────────────────────────────────────────────────────────
 *
 * Подписка нужна: визитки — часть закрытой платформы, и участник,
 * переставший платить, теряет доступ к сообществу так же, как к урокам.
 * Свою собственную страницу он при этом видит всегда.
 */

export type MembersDirectory = {
  members: MemberCard[]
  cities: CityCount[]
  total: number
}

export async function getMembersDirectory(
  userId: string,
  filters: { query: string | null; city: string | null },
): Promise<MembersDirectory | null> {
  if (!(await hasActiveAccess(userId))) return null

  const [members, cities, total] = await Promise.all([
    findMembers(filters),
    findCities(),
    countVisibleMembers(),
  ])

  return { members: members.map(toCard), cities, total }
}

export async function getMemberCard(userId: string, memberId: string): Promise<MemberView | null> {
  if (!(await hasActiveAccess(userId))) return null

  const row = await findMemberById(memberId)

  return row ? toView(row) : null
}

function toCard(row: MemberRow): MemberCard {
  return {
    userId: row.id,
    displayName: row.displayName,
    avatarUrl: avatarUrlFor(row.id, row.avatarId, 'sm'),
    city: row.city,
    skillLevel: row.skillLevel,
    // Стаж, как и у кураторов, считается от года: записанное число
    // устаревает молча
    playingYears: playingYears(row.playingSince),
    curatorSlug: row.curatorSlug,
  }
}

function toView(row: MemberRow): MemberView {
  return {
    ...toCard(row),
    avatarUrl: avatarUrlFor(row.id, row.avatarId, 'lg'),
    bio: row.bio,
    favoriteArtists: row.favoriteArtists,
    favoriteGenres: row.favoriteGenres,
    socials: row.socials,
  }
}

function playingYears(since: number | null): number | null {
  if (!since) return null

  const years = new Date().getFullYear() - since

  return years > 0 ? years : null
}
