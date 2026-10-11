import 'server-only'

import { avatarUrlFor } from '@/modules/identity'
import { errors } from '@/shared/errors'
import { getLogger } from '@/shared/logger'

import { PERMISSION_GROUPS, PERMISSIONS } from './permissions.catalog'
import { OWNER_ROLE_CODE } from './roles.catalog'
import {
  getEffectivePermissions,
  invalidatePermissionsCache,
  isLastOwner,
  requirePermission,
} from './service'
import {
  deleteAllUserPermissions,
  deleteUserPermission,
  findAllRoles,
  findOverridesForUsers,
  findRoleGrants,
  findRolesForUsers,
  findTeamMembers,
  replaceUserRole,
  upsertUserPermission,
} from './team-repository'
import {
  checkCanAssignRole,
  checkCanOverridePermission,
  countOverrides,
  toggleState,
} from './team-rules'

import type { Scope } from './effective-permissions'
import type { PermissionEffect, RoleRef, ToggleState } from './team-rules'

/**
 * Управление командой.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ПРАВИЛА ЖИВУТ НЕ ЗДЕСЬ
 *
 * Этот файл делает три вещи: спрашивает базу, спрашивает правила,
 * выполняет решение. Сами запреты — в `team-rules.ts`, потому что
 * их надо проверять тестами, а тест на файл, который ходит в базу,
 * пришлось бы писать через поднятый PostgreSQL.
 *
 * ПОЧЕМУ ЗАПИСЬ В ЖУРНАЛ ДЕЛАЕТ НЕ ЭТОТ ФАЙЛ
 *
 * Каждое изменение прав обязано попадать в журнал: «почему у Ивана
 * пропала кнопка публикации» иначе решается перепиской. Но пишет туда
 * слой действий, а не этот модуль, — как у эфиров, курса и материалов.
 *
 * Две причины. Журналу нужно спрашивать право `audit.view`, а права
 * живут здесь: обратный импорт замкнул бы модули в кольцо. И адрес
 * запроса, который попадает в запись, известен только слою действий —
 * модуль о запросах ничего не знает и знать не должен.
 *
 * Поэтому функции ниже возвращают то, что изменилось, а записывает
 * это `app/app/manage/team/_actions/team.ts`.
 * ─────────────────────────────────────────────────────────────────
 */

export type TeamMember = {
  userId: string
  displayName: string
  avatarUrl: string | null
  lastSeenAt: Date | null
  isBlocked: boolean
  roles: RoleRef[]
  /** Отклонения от пресета роли: «+2 −1» */
  overrides: { added: number; removed: number }
}

export async function getTeam(actorId: string): Promise<TeamMember[]> {
  await requirePermission(actorId, 'users.roles')

  const members = await findTeamMembers()
  const userIds = members.map((member) => member.userId)

  const [rolesByUser, overridesByUser] = await Promise.all([
    findRolesForUsers(userIds),
    findOverridesForUsers(userIds),
  ])

  const result: TeamMember[] = []

  for (const member of members) {
    const roles = rolesByUser.get(member.userId) ?? []
    const personal = overridesByUser.get(member.userId) ?? []
    const grants = await findRoleGrants(member.userId)

    result.push({
      userId: member.userId,
      displayName: member.displayName,
      avatarUrl: avatarUrlFor(member.userId, member.avatarId, 'sm'),
      lastSeenAt: member.lastSeenAt,
      isBlocked: member.blockedAt !== null,
      roles,
      overrides: countOverrides(grants, personal),
    })
  }

  // Сначала широкие роли: владелец и администраторы наверху списка
  return result.sort((a, b) => (b.roles[0]?.orderIndex ?? 0) - (a.roles[0]?.orderIndex ?? 0))
}

export type PermissionView = {
  key: string
  title: string
  description: string | null
  groupKey: string
  isScoped: boolean
  isSensitive: boolean
  state: ToggleState
  /** Может ли текущий человек вообще трогать это право */
  isEditable: boolean
  /** Почему нельзя, если нельзя */
  lockReason: string | null
}

export type TeamMemberSettings = {
  userId: string
  roles: RoleRef[]
  /** Роли, которые текущий человек вправе назначить */
  assignableRoles: (RoleRef & { id: string; description: string | null })[]
  groups: { key: string; title: string; permissions: PermissionView[] }[]
  overrides: { added: number; removed: number }
}

/**
 * Всё, что нужно панели «Настроить».
 *
 * Права, которых нет у самого распоряжающегося, показываются
 * недоступными с объяснением — а не прячутся. Спрятанное право
 * выглядит как поломка платформы; объяснённое выглядит как правило.
 */
export async function getMemberSettings(
  actorId: string,
  targetId: string,
): Promise<TeamMemberSettings> {
  await requirePermission(actorId, 'users.roles')

  const [rolesByUser, overridesByUser, grants, allRoles, actorPermissions] = await Promise.all([
    findRolesForUsers([actorId, targetId]),
    findOverridesForUsers([targetId]),
    findRoleGrants(targetId),
    findAllRoles(),
    getEffectivePermissions(actorId),
  ])

  const actorRoles = rolesByUser.get(actorId) ?? []
  const targetRoles = rolesByUser.get(targetId) ?? []
  const personal = overridesByUser.get(targetId) ?? []

  const groups = new Map<string, PermissionView[]>()

  for (const permission of PERMISSIONS) {
    const verdict = checkCanOverridePermission({
      actorId,
      targetId,
      actorRoles,
      targetRoles,
      actorPermissions,
      permissionKey: permission.key,
      effect: 'grant',
      isKnownPermission: true,
    })

    const list = groups.get(permission.groupKey) ?? []

    list.push({
      key: permission.key,
      title: permission.title,
      description: permission.description ?? null,
      groupKey: permission.groupKey,
      isScoped: permission.isScoped ?? false,
      isSensitive: permission.isSensitive ?? false,
      state: toggleState(permission.key, grants, personal),
      isEditable: verdict.allowed,
      lockReason: verdict.allowed ? null : verdict.reason,
    })

    groups.set(permission.groupKey, list)
  }

  const assignableRoles = allRoles.filter(
    (role) =>
      checkCanAssignRole({
        actorId,
        targetId,
        actorRoles,
        targetRoles,
        nextRole: role,
        targetIsLastOwner: false,
      }).allowed,
  )

  return {
    userId: targetId,
    roles: targetRoles,
    assignableRoles,
    groups: [...groups.entries()].map(([key, permissions]) => ({
      key,
      title: PERMISSION_GROUPS[key] ?? key,
      permissions,
    })),
    overrides: countOverrides(grants, personal),
  }
}

/** Что именно изменилось — для записи в журнал слоем действий */
export type RoleChange = { from: string[]; to: string[] }

/** Назначает роль или убирает человека из команды */
export async function assignRole(
  actorId: string,
  targetId: string,
  roleCode: string | null,
): Promise<RoleChange> {
  await requirePermission(actorId, 'users.roles')

  const [rolesByUser, allRoles, targetIsLastOwner] = await Promise.all([
    findRolesForUsers([actorId, targetId]),
    findAllRoles(),
    isLastOwner(targetId),
  ])

  const nextRole = roleCode ? (allRoles.find((role) => role.code === roleCode) ?? null) : null
  if (roleCode && !nextRole) throw errors.notFound('Роль не найдена')

  const verdict = checkCanAssignRole({
    actorId,
    targetId,
    actorRoles: rolesByUser.get(actorId) ?? [],
    targetRoles: rolesByUser.get(targetId) ?? [],
    nextRole,
    targetIsLastOwner,
  })

  if (!verdict.allowed) throw errors.conflict(verdict.reason)

  await replaceUserRole(targetId, nextRole?.id ?? null, actorId)
  invalidatePermissionsCache(targetId)

  getLogger().info({ actorId, targetId, roleCode }, 'роль изменена')

  return {
    from: (rolesByUser.get(targetId) ?? []).map((role) => role.code),
    to: nextRole ? [nextRole.code] : [],
  }
}

/** Переопределяет одно право или возвращает его к тому, что даёт роль */
export async function setPermissionOverride(
  actorId: string,
  targetId: string,
  permissionKey: string,
  effect: PermissionEffect,
  scope: Scope | null,
): Promise<void> {
  await requirePermission(actorId, 'users.roles')

  const [rolesByUser, actorPermissions] = await Promise.all([
    findRolesForUsers([actorId, targetId]),
    getEffectivePermissions(actorId),
  ])

  const verdict = checkCanOverridePermission({
    actorId,
    targetId,
    actorRoles: rolesByUser.get(actorId) ?? [],
    targetRoles: rolesByUser.get(targetId) ?? [],
    actorPermissions,
    permissionKey,
    effect,
    isKnownPermission: PERMISSIONS.some((permission) => permission.key === permissionKey),
  })

  if (!verdict.allowed) throw errors.conflict(verdict.reason)

  if (effect === 'inherit') {
    await deleteUserPermission(targetId, permissionKey)
  } else {
    await upsertUserPermission({
      userId: targetId,
      permissionKey,
      effect,
      // Область действия имеет смысл только у выданного права:
      // запрет снимает право целиком
      scope: effect === 'grant' ? scope : null,
      grantedBy: actorId,
    })
  }

  invalidatePermissionsCache(targetId)
}

/** Убирает все исключения: человек получает ровно то, что даёт его роль */
export async function resetOverrides(actorId: string, targetId: string): Promise<void> {
  await requirePermission(actorId, 'users.roles')

  const rolesByUser = await findRolesForUsers([actorId, targetId])
  const targetRoles = rolesByUser.get(targetId) ?? []

  if (targetRoles.some((role) => role.code === OWNER_ROLE_CODE)) {
    throw errors.conflict('Права владельца платформы неотзываемы')
  }

  await deleteAllUserPermissions(targetId)
  invalidatePermissionsCache(targetId)
}
