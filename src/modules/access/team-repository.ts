import 'server-only'

import { and, desc, eq, inArray, isNull } from 'drizzle-orm'

import { users } from '@/modules/identity/schema'
import { db } from '@/shared/db'

import { rolePermissions, roles, userPermissions, userRoles } from './schema'

import type { PersonalOverride, RoleRef } from './team-rules'

/**
 * Запросы экрана «Команда».
 *
 * Отдельно от `repository.ts` намеренно: тот отвечает на вопрос «что может
 * этот человек» и вызывается на каждой отрисовке каждой страницы. Здесь —
 * редкие запросы управления, которые выполняются несколько раз в год.
 * Смешивать горячее с холодным в одном файле значит через год не понимать,
 * что здесь можно трогать.
 */

/** Все роли платформы — для выбора в панели «Настроить» */
export async function findAllRoles(): Promise<
  (RoleRef & { id: string; description: string | null })[]
> {
  return db
    .select({
      id: roles.id,
      code: roles.code,
      title: roles.title,
      description: roles.description,
      orderIndex: roles.orderIndex,
    })
    .from(roles)
    .orderBy(roles.orderIndex)
}

export type TeamMemberRow = {
  userId: string
  displayName: string
  avatarId: string | null
  lastSeenAt: Date | null
  blockedAt: Date | null
}

/**
 * Участники, у которых есть хоть одна роль.
 *
 * Только они: обычных участников двести пятьдесят, и они уже есть
 * на соседнем экране. Список команды, в котором надо искать команду,
 * бессмыслен.
 */
export async function findTeamMembers(): Promise<TeamMemberRow[]> {
  const rows = await db
    .selectDistinct({
      userId: users.id,
      displayName: users.displayName,
      avatarId: users.avatarId,
      lastSeenAt: users.lastSeenAt,
      blockedAt: users.blockedAt,
    })
    .from(userRoles)
    .innerJoin(users, eq(users.id, userRoles.userId))
    .where(isNull(users.deletedAt))
    .orderBy(users.displayName)

  return rows
}

/** Роли нескольких людей разом: ключ — идентификатор человека */
export async function findRolesForUsers(
  userIds: readonly string[],
): Promise<Map<string, RoleRef[]>> {
  const result = new Map<string, RoleRef[]>()
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
    list.push({ code: row.code, title: row.title, orderIndex: row.orderIndex })
    result.set(row.userId, list)
  }

  return result
}

/** Персональные исключения нескольких людей разом */
export async function findOverridesForUsers(
  userIds: readonly string[],
): Promise<Map<string, PersonalOverride[]>> {
  const result = new Map<string, PersonalOverride[]>()
  if (userIds.length === 0) return result

  const rows = await db
    .select({
      userId: userPermissions.userId,
      permissionKey: userPermissions.permissionKey,
      effect: userPermissions.effect,
      scope: userPermissions.scope,
    })
    .from(userPermissions)
    .where(inArray(userPermissions.userId, [...userIds]))

  for (const row of rows) {
    const list = result.get(row.userId) ?? []
    list.push({ permissionKey: row.permissionKey, effect: row.effect, scope: row.scope })
    result.set(row.userId, list)
  }

  return result
}

/** Права, которые даёт набор ролей человека: ключ права → область действия */
export async function findRoleGrants(userId: string): Promise<Map<string, 'own' | 'all' | null>> {
  const rows = await db
    .select({ permissionKey: rolePermissions.permissionKey, scope: rolePermissions.scope })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
    .where(eq(userRoles.userId, userId))

  const result = new Map<string, 'own' | 'all' | null>()

  for (const row of rows) {
    // Из двух ролей побеждает более широкая область — то же правило,
    // что и в вычислении итоговых прав
    const existing = result.get(row.permissionKey) ?? null
    result.set(row.permissionKey, existing === 'all' || row.scope === 'all' ? 'all' : row.scope)
  }

  return result
}

/**
 * Заменяет все роли человека одной.
 *
 * Заменяет, а не добавляет: в интерфейсе роль выбирается переключателем,
 * то есть она одна. Несколько ролей модель допускает, но заводить их
 * из интерфейса незачем — для точечных отличий есть исключения.
 *
 * `null` вместо роли означает «убрать из команды».
 */
export async function replaceUserRole(
  userId: string,
  roleId: string | null,
  grantedBy: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(userRoles).where(eq(userRoles.userId, userId))

    if (roleId) {
      await tx.insert(userRoles).values({ userId, roleId, grantedBy }).onConflictDoNothing()
    }
  })
}

/** Записывает или обновляет персональное исключение */
export async function upsertUserPermission(input: {
  userId: string
  permissionKey: string
  effect: 'grant' | 'deny'
  scope: 'own' | 'all' | null
  grantedBy: string
}): Promise<void> {
  await db
    .insert(userPermissions)
    .values(input)
    .onConflictDoUpdate({
      target: [userPermissions.userId, userPermissions.permissionKey],
      set: {
        effect: input.effect,
        scope: input.scope,
        grantedBy: input.grantedBy,
        grantedAt: new Date(),
      },
    })
}

/** Убирает исключение — право возвращается к тому, что даёт роль */
export async function deleteUserPermission(userId: string, permissionKey: string): Promise<void> {
  await db
    .delete(userPermissions)
    .where(
      and(eq(userPermissions.userId, userId), eq(userPermissions.permissionKey, permissionKey)),
    )
}

/** Убирает все исключения: «сбросить к роли» */
export async function deleteAllUserPermissions(userId: string): Promise<void> {
  await db.delete(userPermissions).where(eq(userPermissions.userId, userId))
}
