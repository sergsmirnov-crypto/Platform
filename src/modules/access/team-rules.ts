import { OWNER_ROLE_CODE } from './roles.catalog'

import type { EffectivePermissions } from './effective-permissions'
import type { Scope } from './effective-permissions'

/**
 * Правила управления командой.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЧИСТЫЕ ФУНКЦИИ, БЕЗ БАЗЫ
 *
 * Здесь только «можно или нельзя, и почему». Сервис узнаёт в базе
 * положение дел, спрашивает эти функции и выполняет решение.
 *
 * Разделение не ради красоты. Каждый запрет ниже закрывает ошибку,
 * которая иначе чинится единственным способом — запросом в базу
 * на боевом сервере. Такое проверяют тестами.
 * ─────────────────────────────────────────────────────────────────
 */

export type Verdict = { allowed: true } | { allowed: false; reason: string }

const ALLOWED: Verdict = { allowed: true }

function deny(reason: string): Verdict {
  return { allowed: false, reason }
}

/** Роль в том виде, в каком она нужна правилам */
export type RoleRef = {
  code: string
  title: string
  /** Чем больше, тем шире роль: куратор 10, владелец 40 */
  orderIndex: number
}

/**
 * Насколько широки роли человека.
 *
 * Ролей может быть несколько, поэтому берётся самая широкая: человек
 * с ролями «куратор» и «администратор» — администратор.
 * Ни одной роли — ноль, и назначить он не может ничего.
 */
export function roleRank(roles: readonly RoleRef[]): number {
  return roles.reduce((max, role) => Math.max(max, role.orderIndex), 0)
}

export function isOwner(roles: readonly RoleRef[]): boolean {
  return roles.some((role) => role.code === OWNER_ROLE_CODE)
}

export type AssignRoleInput = {
  actorId: string
  targetId: string
  /** Роли того, кто выдаёт */
  actorRoles: readonly RoleRef[]
  /** Роли того, кому выдают, — до изменения */
  targetRoles: readonly RoleRef[]
  /** Что назначаем. `null` означает «убрать из команды» */
  nextRole: RoleRef | null
  /** Останется ли платформа без владельца после этого действия */
  targetIsLastOwner: boolean
}

/**
 * Можно ли назначить роль.
 *
 * Четыре запрета:
 *
 *   себе          — понижение запирает самого себя, повышение открывает
 *                   дорогу «куратор → владелец» в два клика
 *   выше своей    — иначе администратор делает себе владельца через
 *                   чужую карточку и обходит предыдущий запрет
 *   владельца     — роль владельца назначается только заполнением базы,
 *                   это не повседневное действие
 *   последнего владельца — платформа осталась бы без хозяина, а вернуть
 *                   права было бы некому
 */
export function checkCanAssignRole(input: AssignRoleInput): Verdict {
  const { actorId, targetId, actorRoles, nextRole, targetIsLastOwner } = input

  if (actorId === targetId) {
    return deny('Свою роль изменить нельзя — попросите другого администратора')
  }

  if (targetIsLastOwner) {
    return deny('Это последний владелец платформы. Сначала назначьте второго')
  }

  if (nextRole?.code === OWNER_ROLE_CODE) {
    return deny('Роль владельца назначается только при настройке платформы')
  }

  // Владелец делает всё остальное без ограничений по ширине роли
  if (isOwner(actorRoles)) return ALLOWED

  const actorRank = roleRank(actorRoles)

  if (actorRank === 0) {
    return deny('У вас нет роли, позволяющей управлять командой')
  }

  if (nextRole && nextRole.orderIndex >= actorRank) {
    return deny(`Нельзя назначить роль «${nextRole.title}»: она не ниже вашей`)
  }

  // Снять роль можно только с того, кто не выше тебя самого
  if (!nextRole && roleRank(input.targetRoles) >= actorRank) {
    return deny('Нельзя менять права человека, чья роль не ниже вашей')
  }

  return ALLOWED
}

/** Что делают с отдельным правом */
export type PermissionEffect = 'inherit' | 'grant' | 'deny'

export type OverridePermissionInput = {
  actorId: string
  targetId: string
  actorRoles: readonly RoleRef[]
  targetRoles: readonly RoleRef[]
  /** Что реально может тот, кто выдаёт */
  actorPermissions: EffectivePermissions
  permissionKey: string
  effect: PermissionEffect
  /** Существует ли такое право вообще */
  isKnownPermission: boolean
}

/**
 * Можно ли переопределить отдельное право.
 *
 * Главное здесь — «нельзя выдать то, чего нет у самого». Без этого
 * правила разделение на роли теряет смысл: старший куратор выдал бы
 * себе через чужую карточку право выдавать права, а следующим шагом —
 * всё остальное.
 *
 * Права владельца неотзываемые: запрет на его карточке не ставится
 * вообще. Иначе владельца можно было бы обезоружить, не трогая роль.
 */
export function checkCanOverridePermission(input: OverridePermissionInput): Verdict {
  const { actorId, targetId, actorRoles, targetRoles, permissionKey, effect } = input

  if (!input.isKnownPermission) {
    return deny('Такого права не существует')
  }

  if (actorId === targetId) {
    return deny('Свои права изменить нельзя — попросите другого администратора')
  }

  if (isOwner(targetRoles)) {
    return deny('Права владельца платформы неотзываемы')
  }

  if (isOwner(actorRoles)) return ALLOWED

  if (roleRank(targetRoles) >= roleRank(actorRoles)) {
    return deny('Нельзя менять права человека, чья роль не ниже вашей')
  }

  // Отнимать можно и то, чего у тебя нет: запрет никому ничего не открывает
  if (effect === 'grant' && !input.actorPermissions.has(permissionKey)) {
    return deny('Нельзя выдать право, которого нет у вас самого')
  }

  return ALLOWED
}

/** Персональное исключение в том виде, в каком оно лежит в базе */
export type PersonalOverride = {
  permissionKey: string
  effect: 'grant' | 'deny'
  scope: Scope | null
}

/**
 * Состояние переключателя в панели «Настроить».
 *
 * Три положения вместо привычных двух: «по роли» — это не то же самое,
 * что «выключено». Право, выключенное принудительно, останется
 * выключенным даже после смены роли; право «по роли» поедет за ней.
 * Свести их в один переключатель — значит однажды получить куратора,
 * которому повысили роль, а он ничего не заметил.
 */
export type ToggleState = {
  effect: PermissionEffect
  /** Область действия, которая получится в итоге */
  scope: Scope | null
  /** Отличается ли от того, что даёт роль */
  isOverridden: boolean
}

export function toggleState(
  permissionKey: string,
  fromRoles: ReadonlyMap<string, Scope | null>,
  personal: readonly PersonalOverride[],
): ToggleState {
  const override = personal.find((row) => row.permissionKey === permissionKey)
  const inRole = fromRoles.has(permissionKey)

  if (!override) {
    return { effect: 'inherit', scope: fromRoles.get(permissionKey) ?? null, isOverridden: false }
  }

  if (override.effect === 'deny') {
    // Запрет права, которого роль и так не даёт, — не отклонение,
    // а бессмысленная запись. Показывать её как «переопределено»
    // значило бы пугать пометкой на пустом месте
    return { effect: 'deny', scope: null, isOverridden: inRole }
  }

  return {
    effect: 'grant',
    scope: override.scope,
    isOverridden: !inRole || fromRoles.get(permissionKey) !== override.scope,
  }
}

/**
 * Сколько прав добавлено и снято относительно роли.
 *
 * Та самая пометка «+2 −1» в списке команды: видно с одного взгляда,
 * у кого настройка нестандартная, и не нужно открывать каждого,
 * чтобы это выяснить.
 */
export function countOverrides(
  fromRoles: ReadonlyMap<string, Scope | null>,
  personal: readonly PersonalOverride[],
): { added: number; removed: number } {
  let added = 0
  let removed = 0

  for (const override of personal) {
    const state = toggleState(override.permissionKey, fromRoles, personal)
    if (!state.isOverridden) continue

    if (override.effect === 'grant') added += 1
    else removed += 1
  }

  return { added, removed }
}

/** Короткая подпись к отклонениям. Пусто, когда их нет */
export function overridesLabel(counts: { added: number; removed: number }): string | null {
  const parts: string[] = []

  if (counts.added > 0) parts.push(`+${counts.added}`)
  if (counts.removed > 0) parts.push(`−${counts.removed}`)

  return parts.length > 0 ? parts.join(' ') : null
}
