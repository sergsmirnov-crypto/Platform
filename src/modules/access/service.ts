import 'server-only'

import { errors } from '@/shared/errors'

import { canActOn, computeEffectivePermissions, hasPermission } from './effective-permissions'
import {
  countUserRoles,
  countUsersWithRole,
  findRoleByCode,
  findRolePermissions,
  findUserPermissions,
  hasRoleWithCode,
  insertUserRole,
} from './repository'
import { OWNER_ROLE_CODE } from './roles.catalog'

import type { EffectivePermissions } from './effective-permissions'

/**
 * Права конкретного человека.
 *
 * Результат ненадолго запоминается в памяти процесса: за одну отрисовку
 * страницы права спрашивают десятки раз, и каждый раз ходить в базу
 * бессмысленно. Время жизни намеренно короткое — тридцать секунд:
 * при снятии прав человек не должен продолжать ими пользоваться дольше
 * этого срока, а сложную систему сброса кэша заводить не за чем.
 */

const CACHE_TTL_MS = 30_000

type CacheEntry = { permissions: EffectivePermissions; expiresAt: number }
const cache = new Map<string, CacheEntry>()

export async function getEffectivePermissions(userId: string): Promise<EffectivePermissions> {
  const cached = cache.get(userId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.permissions
  }

  const [fromRoles, personal] = await Promise.all([
    findRolePermissions(userId),
    findUserPermissions(userId),
  ])

  const permissions = computeEffectivePermissions(fromRoles, personal)
  cache.set(userId, { permissions, expiresAt: Date.now() + CACHE_TTL_MS })

  return permissions
}

/** Сбрасывает кэш после изменения ролей или исключений */
export function invalidatePermissionsCache(userId?: string): void {
  if (userId) cache.delete(userId)
  else cache.clear()
}

export async function can(userId: string, permissionKey: string): Promise<boolean> {
  return hasPermission(await getEffectivePermissions(userId), permissionKey)
}

export async function canOn(
  userId: string,
  permissionKey: string,
  ownerId: string | null | undefined,
): Promise<boolean> {
  return canActOn(await getEffectivePermissions(userId), permissionKey, ownerId, userId)
}

/**
 * Проверка права. Выбрасывает ошибку, если права нет.
 *
 * ПРАВИЛО БЕЗ ИСКЛЮЧЕНИЙ: любое действие, меняющее данные или отдающее
 * закрытое содержимое, начинается с этого вызова. Скрытая в интерфейсе
 * кнопка — это удобство, а не защита: обратиться к серверу можно и минуя
 * интерфейс.
 *
 * @param entityOwnerId кто отвечает за объект. Нужен для прав с областью
 *                      «только свой контент»
 */
export async function requirePermission(
  userId: string | null | undefined,
  permissionKey: string,
  entityOwnerId?: string | null,
): Promise<void> {
  if (!userId) {
    throw errors.unauthorized()
  }

  const allowed =
    entityOwnerId === undefined
      ? await can(userId, permissionKey)
      : await canOn(userId, permissionKey, entityOwnerId)

  if (!allowed) {
    throw errors.forbidden()
  }
}

/**
 * Выдаёт человеку роль по её коду.
 *
 * Используется при назначении владельца во время первого входа
 * и на экране «Команда» (Этап 9).
 *
 * @param grantedBy кто выдал. `null` означает «система», без участия человека
 */
export async function grantRoleByCode(
  userId: string,
  roleCode: string,
  grantedBy: string | null = null,
): Promise<void> {
  const role = await findRoleByCode(roleCode)

  if (!role) {
    throw errors.conflict(
      `Роль «${roleCode}» не найдена. Выполните первоначальное заполнение базы: pnpm db:seed`,
    )
  }

  await insertUserRole(userId, role.id, grantedBy)
  invalidatePermissionsCache(userId)
}

/** Есть ли у человека хоть какая-нибудь роль */
export async function hasAnyRole(userId: string): Promise<boolean> {
  return (await countUserRoles(userId)) > 0
}

/**
 * Единственный ли это владелец платформы.
 *
 * Нужно там, где владелец может исчезнуть: удаление собственного
 * аккаунта, а позже — понижение роли на экране «Команда». Платформа
 * без владельца — это платформа, у которой некому выдать права обратно;
 * чинится такое только руками в базе (PRD v0.3 §2.3).
 */
export async function isLastOwner(userId: string): Promise<boolean> {
  if (!(await hasRoleWithCode(userId, OWNER_ROLE_CODE))) return false

  return (await countUsersWithRole(OWNER_ROLE_CODE)) <= 1
}
