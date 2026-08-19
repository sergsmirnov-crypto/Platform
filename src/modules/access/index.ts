/**
 * Публичный вход в модуль прав доступа.
 *
 * Остальные модули работают только с тем, что перечислено здесь.
 */
export {
  can,
  canOn,
  getEffectivePermissions,
  grantRoleByCode,
  hasAnyRole,
  invalidatePermissionsCache,
  isLastOwner,
  requirePermission,
} from './service'

export { PERMISSIONS, PERMISSION_GROUPS, PERMISSION_KEYS } from './permissions.catalog'
export type { PermissionDefinition, PermissionKey } from './permissions.catalog'
export { ROLES, OWNER_ROLE_CODE } from './roles.catalog'
export type { RoleDefinition, RoleScope } from './roles.catalog'

export { countOverrides, isOwner, overridesLabel, roleRank, toggleState } from './team-rules'
export type { PermissionEffect, PersonalOverride, RoleRef, ToggleState } from './team-rules'

export { canActOn, computeEffectivePermissions, hasPermission } from './effective-permissions'
export type { EffectivePermissions, Scope } from './effective-permissions'
