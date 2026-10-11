import { describe, expect, it } from 'vitest'

import {
  checkCanAssignRole,
  checkCanOverridePermission,
  countOverrides,
  isOwner,
  overridesLabel,
  roleRank,
  toggleState,
} from './team-rules'

import type { Scope } from './effective-permissions'
import type { PersonalOverride, RoleRef } from './team-rules'

const ACTOR = 'actor-id'
const TARGET = 'target-id'

const CURATOR: RoleRef = { code: 'curator', title: 'Куратор', orderIndex: 10 }
const SENIOR: RoleRef = { code: 'senior_curator', title: 'Старший куратор', orderIndex: 20 }
const ADMIN: RoleRef = { code: 'admin', title: 'Администратор', orderIndex: 30 }
const OWNER: RoleRef = { code: 'owner', title: 'Владелец', orderIndex: 40 }

function assign(overrides: Partial<Parameters<typeof checkCanAssignRole>[0]> = {}) {
  return checkCanAssignRole({
    actorId: ACTOR,
    targetId: TARGET,
    actorRoles: [ADMIN],
    targetRoles: [CURATOR],
    nextRole: SENIOR,
    targetIsLastOwner: false,
    ...overrides,
  })
}

describe('ширина роли', () => {
  it('без ролей ранг нулевой', () => {
    expect(roleRank([])).toBe(0)
  })

  it('берётся самая широкая роль', () => {
    expect(roleRank([CURATOR, ADMIN])).toBe(30)
  })

  it('владелец опознаётся по коду', () => {
    expect(isOwner([CURATOR, OWNER])).toBe(true)
    expect(isOwner([ADMIN])).toBe(false)
  })
})

describe('назначение роли', () => {
  it('администратор назначает старшего куратора', () => {
    expect(assign()).toEqual({ allowed: true })
  })

  it('свою роль изменить нельзя', () => {
    expect(assign({ targetId: ACTOR }).allowed).toBe(false)
  })

  it('нельзя назначить роль не ниже своей', () => {
    expect(assign({ actorRoles: [SENIOR], nextRole: ADMIN }).allowed).toBe(false)
    expect(assign({ actorRoles: [SENIOR], nextRole: SENIOR }).allowed).toBe(false)
  })

  it('роль владельца через интерфейс не назначается', () => {
    expect(assign({ actorRoles: [OWNER], nextRole: OWNER }).allowed).toBe(false)
  })

  it('последнего владельца понизить нельзя', () => {
    expect(assign({ targetIsLastOwner: true, nextRole: CURATOR }).allowed).toBe(false)
  })

  it('последнего владельца нельзя и убрать из команды', () => {
    expect(assign({ targetIsLastOwner: true, nextRole: null }).allowed).toBe(false)
  })

  it('человек без роли не управляет командой', () => {
    expect(assign({ actorRoles: [] }).allowed).toBe(false)
  })

  it('владелец назначает любую роль, кроме владельца', () => {
    expect(assign({ actorRoles: [OWNER], nextRole: ADMIN })).toEqual({ allowed: true })
  })

  it('нельзя убрать из команды того, чья роль не ниже своей', () => {
    expect(assign({ actorRoles: [SENIOR], targetRoles: [ADMIN], nextRole: null }).allowed).toBe(
      false,
    )
  })

  it('убрать из команды того, кто ниже, можно', () => {
    expect(assign({ actorRoles: [ADMIN], targetRoles: [CURATOR], nextRole: null })).toEqual({
      allowed: true,
    })
  })
})

function permissions(...keys: string[]): ReadonlyMap<string, Scope | null> {
  return new Map(keys.map((key) => [key, null]))
}

function override(overrides: Partial<Parameters<typeof checkCanOverridePermission>[0]> = {}) {
  return checkCanOverridePermission({
    actorId: ACTOR,
    targetId: TARGET,
    actorRoles: [ADMIN],
    targetRoles: [CURATOR],
    actorPermissions: permissions('songs.edit', 'songs.delete'),
    permissionKey: 'songs.delete',
    effect: 'grant',
    isKnownPermission: true,
    ...overrides,
  })
}

describe('переопределение отдельного права', () => {
  it('администратор выдаёт куратору право, которое есть у него самого', () => {
    expect(override()).toEqual({ allowed: true })
  })

  it('несуществующее право не принимается', () => {
    expect(override({ isKnownPermission: false }).allowed).toBe(false)
  })

  it('свои права изменить нельзя', () => {
    expect(override({ targetId: ACTOR }).allowed).toBe(false)
  })

  it('права владельца неотзываемы', () => {
    expect(override({ targetRoles: [OWNER], effect: 'deny' }).allowed).toBe(false)
  })

  it('владелец не может даже сам себе оставить лазейку через другого владельца', () => {
    expect(override({ actorRoles: [OWNER], targetRoles: [OWNER] }).allowed).toBe(false)
  })

  it('нельзя выдать право, которого нет у самого', () => {
    expect(override({ permissionKey: 'settings.edit' }).allowed).toBe(false)
  })

  it('отнять можно и то, чего у тебя нет: запрет ничего не открывает', () => {
    expect(override({ permissionKey: 'settings.edit', effect: 'deny' })).toEqual({ allowed: true })
  })

  it('нельзя трогать права того, чья роль не ниже своей', () => {
    expect(override({ actorRoles: [SENIOR], targetRoles: [ADMIN] }).allowed).toBe(false)
  })

  it('владелец выдаёт любое право', () => {
    expect(
      override({
        actorRoles: [OWNER],
        actorPermissions: permissions(),
        permissionKey: 'flags.edit',
      }),
    ).toEqual({ allowed: true })
  })
})

const ROLE_PERMISSIONS = new Map<string, Scope | null>([
  ['songs.edit', 'own'],
  ['songs.create', null],
])

describe('состояние переключателя', () => {
  it('без исключения право наследуется от роли', () => {
    expect(toggleState('songs.create', ROLE_PERMISSIONS, [])).toEqual({
      effect: 'inherit',
      scope: null,
      isOverridden: false,
    })
  })

  it('область действия берётся из роли', () => {
    expect(toggleState('songs.edit', ROLE_PERMISSIONS, []).scope).toBe('own')
  })

  it('запрет права, которое даёт роль, — отклонение', () => {
    const personal: PersonalOverride[] = [
      { permissionKey: 'songs.create', effect: 'deny', scope: null },
    ]

    expect(toggleState('songs.create', ROLE_PERMISSIONS, personal)).toEqual({
      effect: 'deny',
      scope: null,
      isOverridden: true,
    })
  })

  it('запрет права, которого роль не даёт, отклонением не считается', () => {
    const personal: PersonalOverride[] = [
      { permissionKey: 'settings.edit', effect: 'deny', scope: null },
    ]

    expect(toggleState('settings.edit', ROLE_PERMISSIONS, personal).isOverridden).toBe(false)
  })

  it('выдача права сверх роли — отклонение', () => {
    const personal: PersonalOverride[] = [
      { permissionKey: 'songs.delete', effect: 'grant', scope: null },
    ]

    expect(toggleState('songs.delete', ROLE_PERMISSIONS, personal).isOverridden).toBe(true)
  })

  it('расширение области действия тоже отклонение', () => {
    const personal: PersonalOverride[] = [
      { permissionKey: 'songs.edit', effect: 'grant', scope: 'all' },
    ]

    const state = toggleState('songs.edit', ROLE_PERMISSIONS, personal)

    expect(state.scope).toBe('all')
    expect(state.isOverridden).toBe(true)
  })
})

describe('счётчик отклонений', () => {
  it('без исключений отклонений нет', () => {
    expect(countOverrides(ROLE_PERMISSIONS, [])).toEqual({ added: 0, removed: 0 })
  })

  it('считает добавленные и снятые права', () => {
    const personal: PersonalOverride[] = [
      { permissionKey: 'songs.delete', effect: 'grant', scope: null },
      { permissionKey: 'news.publish', effect: 'grant', scope: null },
      { permissionKey: 'songs.create', effect: 'deny', scope: null },
    ]

    expect(countOverrides(ROLE_PERMISSIONS, personal)).toEqual({ added: 2, removed: 1 })
  })

  it('бессмысленные записи не считаются', () => {
    const personal: PersonalOverride[] = [
      { permissionKey: 'settings.edit', effect: 'deny', scope: null },
    ]

    expect(countOverrides(ROLE_PERMISSIONS, personal)).toEqual({ added: 0, removed: 0 })
  })

  it('подпись собирается из обоих чисел', () => {
    expect(overridesLabel({ added: 2, removed: 1 })).toBe('+2 −1')
    expect(overridesLabel({ added: 0, removed: 3 })).toBe('−3')
    expect(overridesLabel({ added: 0, removed: 0 })).toBeNull()
  })
})
