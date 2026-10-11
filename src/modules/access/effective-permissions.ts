/**
 * Вычисление итоговых прав человека.
 *
 * Модель из PRD v0.3:
 *
 *     права всех ролей человека
 *   + персональные разрешения
 *   − персональные запреты
 *   ─────────────────────────
 *   = что человек реально может
 *
 * Два правила, которые нельзя нарушать:
 *
 * 1. **Запрет всегда сильнее разрешения.** Если право отнято персонально,
 *    никакая роль его не вернёт. Иначе отозвать возможность у конкретного
 *    человека было бы невозможно, не трогая роль целиком.
 *
 * 2. **Из областей действия побеждает более широкая.** Если одна роль даёт
 *    «только свой контент», а другая — «любой», человек получает «любой».
 *
 * Функции здесь чистые: они не ходят в базу и не знают о ней. Поэтому
 * их можно полностью покрыть тестами — а для модели прав это обязательно,
 * ошибка здесь означает либо утечку доступа, либо заблокированного куратора.
 */

export type Scope = 'own' | 'all'

/** Право, пришедшее из роли */
export type RolePermissionRow = { permissionKey: string; scope: Scope | null }

/** Персональное исключение */
export type UserPermissionRow = {
  permissionKey: string
  effect: 'grant' | 'deny'
  scope: Scope | null
}

/**
 * Итоговый набор прав.
 * Ключ — право, значение — область действия (или null, если её нет).
 */
export type EffectivePermissions = ReadonlyMap<string, Scope | null>

/** Более широкая область побеждает: all > own > отсутствует */
function widerScope(a: Scope | null, b: Scope | null): Scope | null {
  if (a === 'all' || b === 'all') return 'all'
  if (a === 'own' || b === 'own') return 'own'
  return null
}

export function computeEffectivePermissions(
  fromRoles: readonly RolePermissionRow[],
  personal: readonly UserPermissionRow[],
): EffectivePermissions {
  const result = new Map<string, Scope | null>()

  for (const row of fromRoles) {
    const existing = result.has(row.permissionKey) ? (result.get(row.permissionKey) ?? null) : null
    result.set(row.permissionKey, widerScope(existing, row.scope))
  }

  for (const row of personal) {
    if (row.effect !== 'grant') continue
    const existing = result.has(row.permissionKey) ? (result.get(row.permissionKey) ?? null) : null
    result.set(row.permissionKey, widerScope(existing, row.scope))
  }

  // Запреты применяются последними и снимают право целиком,
  // независимо от области действия
  for (const row of personal) {
    if (row.effect === 'deny') {
      result.delete(row.permissionKey)
    }
  }

  return result
}

/** Есть ли у человека право вообще, безотносительно конкретного объекта */
export function hasPermission(permissions: EffectivePermissions, key: string): boolean {
  return permissions.has(key)
}

/**
 * Может ли человек выполнить действие над конкретным объектом.
 *
 * @param ownerId     кто отвечает за объект (куратор разбора, автор новости)
 * @param currentUserId кто пытается выполнить действие
 */
export function canActOn(
  permissions: EffectivePermissions,
  key: string,
  ownerId: string | null | undefined,
  currentUserId: string,
): boolean {
  if (!permissions.has(key)) return false

  const scope = permissions.get(key) ?? null

  // Право без области действия работает везде
  if (scope === null || scope === 'all') return true

  // scope === 'own': только свой контент.
  // У объекта без владельца своего быть не может — значит, нельзя.
  return ownerId != null && ownerId === currentUserId
}
