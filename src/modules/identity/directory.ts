import 'server-only'

import { requirePermission } from '@/modules/access'
import { AUDIT_ACTIONS, recordAudit } from '@/modules/audit'
import { appConfig } from '@/shared/config'
import { errors } from '@/shared/errors'
import { getLogger } from '@/shared/logger'

import { avatarUrlFor } from './avatar-url'
import { DEFAULT_MEMBER_FILTERS } from './directory-filters'
import {
  countCompletedByType,
  countMembers,
  findDisplayNames,
  findMemberDetails,
  findMembersPage,
  findRolesForUsers,
  setMemberBlocked,
} from './directory-repository'
import { checkCanBlock, checkCanUnblock } from './moderation'
import { revokeAllSessions } from './repository'

import type { MemberFilters } from './directory-filters'
import type { MemberDetailsRow, MemberListRow } from './directory-repository'
import type { ModerationTarget } from './moderation'

/**
 * Список участников для управления.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЧТО ЭТОТ ЭКРАН ПОКАЗЫВАЕТ, А ЧТО — НЕТ
 *
 * Право `users.view` звучит как «видеть участников», но означает
 * «видеть служебные сведения»: платит ли, когда заходил, есть ли роль.
 * Личное в этот список не попадает и не должно: заметки к разборам,
 * подробности прогресса по конкретным урокам, переписка.
 *
 * Граница проходит по вопросу «нужно ли это, чтобы человеку помочь».
 * Дата последнего входа — нужна: с неё начинается разбор жалобы
 * «у меня ничего не открывается». Заметка «здесь я застреваю» —
 * не нужна никогда.
 * ─────────────────────────────────────────────────────────────────
 */

const OWNER_ROLE_CODES = new Set(['owner'])

export type MemberSummary = {
  userId: string
  displayName: string
  avatarUrl: string | null
  city: string | null
  telegramUsername: string | null
  joinedAt: Date
  lastSeenAt: Date | null
  isBlocked: boolean
  accessStatus: 'none' | 'active' | 'grace' | 'expired'
  validUntil: Date | null
  roles: { code: string; title: string }[]
}

export type MembersPage = {
  members: MemberSummary[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export async function getMembersPage(
  actorId: string,
  filters: MemberFilters = DEFAULT_MEMBER_FILTERS,
): Promise<MembersPage> {
  await requirePermission(actorId, 'users.view')

  const pageSize = appConfig.manage.membersPageSize
  const [total, rows] = await Promise.all([
    countMembers(filters),
    findMembersPage(filters, { limit: pageSize, offset: (filters.page - 1) * pageSize }),
  ])

  const roles = await findRolesForUsers(rows.map((row) => row.id))

  return {
    members: rows.map((row) => toSummary(row, roles.get(row.id) ?? [])),
    total,
    page: filters.page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}

export type MemberDetails = MemberSummary & {
  bio: string | null
  skillLevel: 'beginner' | 'intermediate' | 'advanced' | null
  playingSince: number | null
  favoriteArtists: string[]
  favoriteGenres: string[]
  /** Открыл ли человек свою визитку клубу */
  isProfilePublic: boolean
  onboardingDoneAt: Date | null
  blockedReason: string | null
  /** Кто заблокировал. Имя, а не идентификатор: карточку читает человек */
  blockedByName: string | null
  accessSource: 'telegram_channel' | 'telegram_payment' | 'manual' | 'promo' | 'toolsy' | null
  graceUntil: Date | null
  lastVerifiedAt: Date | null
  /** Сколько уроков и разборов доведено до конца — короткая справка */
  completedLessons: number
  completedArrangements: number
}

export async function getMemberDetails(
  actorId: string,
  memberId: string,
): Promise<MemberDetails | null> {
  await requirePermission(actorId, 'users.view')

  const row = await findMemberDetails(memberId)
  if (!row) return null

  const [roles, completed, names] = await Promise.all([
    findRolesForUsers([row.id]),
    countCompletedByType(row.id),
    row.blockedBy ? findDisplayNames([row.blockedBy]) : Promise.resolve(new Map<string, string>()),
  ])

  return toDetails(row, roles.get(row.id) ?? [], completed, names)
}

/**
 * Блокирует участника.
 *
 * Порядок шагов важен: сначала отметка в базе, потом закрытие сессий.
 * При обратном порядке прерывание между шагами оставило бы человека
 * выброшенным с платформы, но не заблокированным, — он просто вошёл бы
 * заново, и никто бы не понял, что произошло.
 */
export async function blockMember(
  actorId: string,
  memberId: string,
  reason: string,
  context: { ipHash?: string | null } = {},
): Promise<void> {
  await requirePermission(actorId, 'users.ban')

  const target = await loadTarget(memberId)
  const verdict = checkCanBlock(actorId, target)

  if (!verdict.allowed) throw errors.conflict(verdict.reason)

  await setMemberBlocked(memberId, { reason, byUserId: actorId })
  await revokeAllSessions(memberId)

  await recordAudit({
    actorId,
    action: AUDIT_ACTIONS.userBlock,
    entityType: 'user',
    entityId: memberId,
    diff: { reason },
    ipHash: context.ipHash ?? null,
  })

  getLogger().info({ actorId, memberId }, 'участник заблокирован')
}

export async function unblockMember(
  actorId: string,
  memberId: string,
  context: { ipHash?: string | null } = {},
): Promise<void> {
  await requirePermission(actorId, 'users.ban')

  const target = await loadTarget(memberId)
  const verdict = checkCanUnblock(target)

  if (!verdict.allowed) throw errors.conflict(verdict.reason)

  await setMemberBlocked(memberId, null)

  await recordAudit({
    actorId,
    action: AUDIT_ACTIONS.userUnblock,
    entityType: 'user',
    entityId: memberId,
    ipHash: context.ipHash ?? null,
  })

  getLogger().info({ actorId, memberId }, 'блокировка участника снята')
}

/** Собирает то немногое, что нужно правилам блокировки */
async function loadTarget(memberId: string): Promise<ModerationTarget> {
  const row = await findMemberDetails(memberId)
  if (!row) throw errors.notFound('Участник не найден')

  const roles = (await findRolesForUsers([memberId])).get(memberId) ?? []

  return {
    userId: memberId,
    isOwner: roles.some((role) => OWNER_ROLE_CODES.has(role.code)),
    isBlocked: row.blockedAt !== null,
  }
}

function toSummary(row: MemberListRow, roles: { code: string; title: string }[]): MemberSummary {
  return {
    userId: row.id,
    displayName: row.displayName,
    avatarUrl: avatarUrlFor(row.id, row.avatarId, 'sm'),
    city: row.city,
    telegramUsername: row.telegramUsername,
    joinedAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
    isBlocked: row.blockedAt !== null,
    // Записи о доступе может не быть вовсе — это то же самое,
    // что «подписка не оформлена»
    accessStatus: row.accessStatus ?? 'none',
    validUntil: row.validUntil,
    roles,
  }
}

function toDetails(
  row: MemberDetailsRow,
  roles: { code: string; title: string }[],
  completed: Map<string, number>,
  names: Map<string, string>,
): MemberDetails {
  return {
    ...toSummary(row, roles),
    avatarUrl: avatarUrlFor(row.id, row.avatarId, 'lg'),
    bio: row.bio,
    skillLevel: row.skillLevel,
    playingSince: row.playingSince,
    favoriteArtists: row.favoriteArtists,
    favoriteGenres: row.favoriteGenres,
    isProfilePublic: row.profileVisibility === 'club',
    onboardingDoneAt: row.onboardingDoneAt,
    blockedReason: row.blockedReason,
    blockedByName: row.blockedBy ? (names.get(row.blockedBy) ?? null) : null,
    accessSource: row.accessSource,
    graceUntil: row.graceUntil,
    lastVerifiedAt: row.lastVerifiedAt,
    completedLessons: completed.get('lesson') ?? 0,
    completedArrangements: completed.get('arrangement') ?? 0,
  }
}
