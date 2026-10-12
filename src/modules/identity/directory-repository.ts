import 'server-only'

import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'

import { roles, userRoles } from '@/modules/access/schema'
import { progress } from '@/modules/progress/schema'
import { entitlements } from '@/modules/subscription/schema'
import { db } from '@/shared/db'

import { authIdentities, users } from './schema'

import type { MemberFilters } from './directory-filters'
import type { SQL } from 'drizzle-orm'

/**
 * Запросы списка участников — для тех, у кого есть право `users.view`.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЭТО НЕ ТО ЖЕ, ЧТО ВИЗИТКИ УЧАСТНИКОВ
 *
 * `club/members-repository.ts` показывает клубу тех, кто сам открыл
 * свой профиль, и никогда не отдаёт подписку, последний вход и прогресс.
 * Здесь ровно наоборот: видно всех, включая закрытых, и видно именно
 * служебные сведения — потому что вопрос другой. Не «кто ещё из Казани»,
 * а «человек написал в поддержку, что у него пропал доступ».
 *
 * Два разных вопроса — два разных набора запросов. Попытка обслужить оба
 * одним закончилась бы полем «показывать ли подписку», которое однажды
 * забыли бы выставить.
 * ─────────────────────────────────────────────────────────────────
 *
 * Роли выбираются отдельным запросом по идентификаторам страницы,
 * а не присоединением: у человека с двумя ролями строка задвоилась бы,
 * и постраничная навигация начала бы врать.
 */

export type MemberListRow = {
  id: string
  displayName: string
  avatarId: string | null
  city: string | null
  telegramUsername: string | null
  createdAt: Date
  lastSeenAt: Date | null
  blockedAt: Date | null
  accessStatus: 'none' | 'active' | 'grace' | 'expired' | null
  validUntil: Date | null
}

/** Имя пользователя в Telegram лежит в дополнительных данных способа входа */
const telegramUsername = sql<string | null>`${authIdentities.providerData}->>'username'`

const listColumns = {
  id: users.id,
  displayName: users.displayName,
  avatarId: users.avatarId,
  city: users.city,
  telegramUsername,
  createdAt: users.createdAt,
  lastSeenAt: users.lastSeenAt,
  blockedAt: users.blockedAt,
  accessStatus: entitlements.status,
  validUntil: entitlements.validUntil,
}

function baseQuery() {
  return db
    .select(listColumns)
    .from(users)
    .leftJoin(
      authIdentities,
      and(eq(authIdentities.userId, users.id), eq(authIdentities.provider, 'telegram')),
    )
    .leftJoin(entitlements, eq(entitlements.userId, users.id))
}

/**
 * Условия отбора.
 *
 * Удалённые не показываются нигде: строка участника остаётся ради истории
 * подписок и авторства, но человека на платформе больше нет, и в списке
 * ему делать нечего.
 */
function conditions(filters: MemberFilters): SQL[] {
  const where: SQL[] = [isNull(users.deletedAt)]

  if (filters.query) {
    const pattern = `%${filters.query}%`

    // Поиск включает имя в Telegram: человек пишет в поддержку оттуда,
    // и это единственное, что о нём известно наверняка
    where.push(
      or(
        ilike(users.displayName, pattern),
        ilike(users.city, pattern),
        sql`${telegramUsername} ilike ${pattern}`,
      ) as SQL,
    )
  }

  if (filters.access) {
    where.push(
      filters.access === 'none'
        ? // Записи о доступе может не быть вовсе — у того, кто ни разу
          // не касался подписки. Это то же самое, что «нет подписки»
          (or(isNull(entitlements.status), eq(entitlements.status, 'none')) as SQL)
        : eq(entitlements.status, filters.access),
    )
  }

  if (filters.blocked) where.push(isNotNull(users.blockedAt))

  if (filters.team) {
    where.push(sql`exists (select 1 from ${userRoles} where ${userRoles.userId} = ${users.id})`)
  }

  return where
}

function order(filters: MemberFilters) {
  if (filters.sort === 'name') return [asc(users.displayName)]
  if (filters.sort === 'joined') return [desc(users.createdAt)]

  // «Недавно заходившие»: те, кто не заходил ни разу, уходят в конец,
  // а не всплывают наверх пустой датой
  return [sql`${users.lastSeenAt} desc nulls last`, desc(users.createdAt)]
}

export async function findMembersPage(
  filters: MemberFilters,
  page: { limit: number; offset: number },
): Promise<MemberListRow[]> {
  return baseQuery()
    .where(and(...conditions(filters)))
    .orderBy(...order(filters))
    .limit(page.limit)
    .offset(page.offset)
}

export async function countMembers(filters: MemberFilters): Promise<number> {
  const [row] = await db
    .select({ total: count(users.id) })
    .from(users)
    .leftJoin(
      authIdentities,
      and(eq(authIdentities.userId, users.id), eq(authIdentities.provider, 'telegram')),
    )
    .leftJoin(entitlements, eq(entitlements.userId, users.id))
    .where(and(...conditions(filters)))

  return row?.total ?? 0
}

/** Роли участников страницы: ключ — идентификатор человека */
export async function findRolesForUsers(
  userIds: readonly string[],
): Promise<Map<string, { code: string; title: string }[]>> {
  const result = new Map<string, { code: string; title: string }[]>()
  if (userIds.length === 0) return result

  const rows = await db
    .select({
      userId: userRoles.userId,
      code: roles.code,
      title: roles.title,
      orderIndex: roles.orderIndex,
    })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(inArray(userRoles.userId, [...userIds]))
    .orderBy(desc(roles.orderIndex))

  for (const row of rows) {
    const list = result.get(row.userId) ?? []
    list.push({ code: row.code, title: row.title })
    result.set(row.userId, list)
  }

  return result
}

export type MemberDetailsRow = MemberListRow & {
  bio: string | null
  skillLevel: 'beginner' | 'intermediate' | 'advanced' | null
  playingSince: number | null
  favoriteArtists: string[]
  favoriteGenres: string[]
  profileVisibility: 'private' | 'club'
  onboardingDoneAt: Date | null
  blockedReason: string | null
  blockedBy: string | null
  accessSource: 'telegram_channel' | 'telegram_payment' | 'manual' | 'promo' | 'toolsy' | null
  graceUntil: Date | null
  lastVerifiedAt: Date | null
}

export async function findMemberDetails(userId: string): Promise<MemberDetailsRow | null> {
  const rows = await db
    .select({
      ...listColumns,
      bio: users.bio,
      skillLevel: users.skillLevel,
      playingSince: users.playingSince,
      favoriteArtists: users.favoriteArtists,
      favoriteGenres: users.favoriteGenres,
      profileVisibility: users.profileVisibility,
      onboardingDoneAt: users.onboardingDoneAt,
      blockedReason: users.blockedReason,
      blockedBy: users.blockedBy,
      accessSource: entitlements.source,
      graceUntil: entitlements.graceUntil,
      lastVerifiedAt: entitlements.lastVerifiedAt,
    })
    .from(users)
    .leftJoin(
      authIdentities,
      and(eq(authIdentities.userId, users.id), eq(authIdentities.provider, 'telegram')),
    )
    .leftJoin(entitlements, eq(entitlements.userId, users.id))
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1)

  return rows[0] ?? null
}

/**
 * Сколько человек прошёл — по видам содержимого.
 *
 * Одним запросом с группировкой, а не четырьмя: на карточке эти числа
 * нужны все сразу и только для справки.
 */
export async function countCompletedByType(userId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({ entityType: progress.entityType, total: count(progress.id) })
    .from(progress)
    .where(
      and(
        eq(progress.userId, userId),
        or(isNotNull(progress.completedAt), eq(progress.completedManually, true)),
      ),
    )
    .groupBy(progress.entityType)

  return new Map(rows.map((row) => [row.entityType, row.total]))
}

/** Имена людей по идентификаторам — для строки «заблокировал такой-то» */
export async function findDisplayNames(userIds: readonly string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map()

  const rows = await db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(inArray(users.id, [...userIds]))

  return new Map(rows.map((row) => [row.id, row.displayName]))
}

export async function setMemberBlocked(
  userId: string,
  blocked: { reason: string; byUserId: string } | null,
): Promise<void> {
  await db
    .update(users)
    .set(
      blocked
        ? { blockedAt: new Date(), blockedReason: blocked.reason, blockedBy: blocked.byUserId }
        : { blockedAt: null, blockedReason: null, blockedBy: null },
    )
    .where(eq(users.id, userId))
}
