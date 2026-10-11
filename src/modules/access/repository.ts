import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import { users } from '@/modules/identity/schema'
import { db } from '@/shared/db'

import { rolePermissions, roles, userPermissions, userRoles } from './schema'

import type { RolePermissionRow, UserPermissionRow } from './effective-permissions'

/**
 * Запросы к базе, связанные с правами.
 *
 * Единственное место в модуле, где есть SQL. Всё остальное работает
 * с уже полученными данными.
 */

/** Права, которые человек получает через свои роли */
export async function findRolePermissions(userId: string): Promise<RolePermissionRow[]> {
  const rows = await db
    .select({
      permissionKey: rolePermissions.permissionKey,
      scope: rolePermissions.scope,
    })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .where(eq(userRoles.userId, userId))

  return rows
}

/** Персональные исключения человека */
export async function findUserPermissions(userId: string): Promise<UserPermissionRow[]> {
  const rows = await db
    .select({
      permissionKey: userPermissions.permissionKey,
      effect: userPermissions.effect,
      scope: userPermissions.scope,
    })
    .from(userPermissions)
    .where(eq(userPermissions.userId, userId))

  return rows
}

/** Роль по её коду: 'owner', 'curator' */
export async function findRoleByCode(code: string): Promise<{ id: string } | null> {
  const rows = await db.select({ id: roles.id }).from(roles).where(eq(roles.code, code)).limit(1)

  return rows[0] ?? null
}

/** Есть ли у человека хотя бы одна роль */
export async function countUserRoles(userId: string): Promise<number> {
  const rows = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(eq(userRoles.userId, userId))

  return rows.length
}

/** Есть ли у человека роль с таким кодом */
export async function hasRoleWithCode(userId: string, roleCode: string): Promise<boolean> {
  const rows = await db
    .select({ id: userRoles.roleId })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(userRoles.userId, userId), eq(roles.code, roleCode)))
    .limit(1)

  return rows.length > 0
}

/**
 * Сколько живых участников имеют роль с таким кодом.
 *
 * Удалённые не считаются: иначе «последний владелец» определялся бы
 * по людям, которых на платформе больше нет, и настоящий последний
 * владелец смог бы удалить себя, оставив платформу без хозяина.
 */
export async function countUsersWithRole(roleCode: string): Promise<number> {
  const rows = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .innerJoin(users, eq(users.id, userRoles.userId))
    .where(and(eq(roles.code, roleCode), isNull(users.deletedAt)))

  return rows.length
}

/**
 * Выдаёт роль.
 *
 * Повторный вызов безопасен: связка «человек — роль» уникальна,
 * и попытка выдать уже выданное ничего не меняет.
 */
export async function insertUserRole(
  userId: string,
  roleId: string,
  grantedBy: string | null,
): Promise<void> {
  await db.insert(userRoles).values({ userId, roleId, grantedBy }).onConflictDoNothing()
}
