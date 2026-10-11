import { describe, expect, it } from 'vitest'

import { canActOn, computeEffectivePermissions, hasPermission } from './effective-permissions'

import type { RolePermissionRow, UserPermissionRow } from './effective-permissions'

const ME = 'user-me'
const SOMEONE_ELSE = 'user-other'

function roles(...rows: RolePermissionRow[]): RolePermissionRow[] {
  return rows
}
function personal(...rows: UserPermissionRow[]): UserPermissionRow[] {
  return rows
}

describe('вычисление итоговых прав', () => {
  it('берёт права из роли', () => {
    const result = computeEffectivePermissions(
      roles({ permissionKey: 'songs.create', scope: null }),
      [],
    )
    expect(hasPermission(result, 'songs.create')).toBe(true)
    expect(hasPermission(result, 'songs.delete')).toBe(false)
  })

  it('объединяет права нескольких ролей', () => {
    const result = computeEffectivePermissions(
      roles(
        { permissionKey: 'songs.create', scope: null },
        { permissionKey: 'news.create', scope: null },
      ),
      [],
    )
    expect(hasPermission(result, 'songs.create')).toBe(true)
    expect(hasPermission(result, 'news.create')).toBe(true)
  })

  it('из двух областей действия оставляет более широкую', () => {
    const result = computeEffectivePermissions(
      roles(
        { permissionKey: 'songs.edit', scope: 'own' },
        { permissionKey: 'songs.edit', scope: 'all' },
      ),
      [],
    )
    expect(result.get('songs.edit')).toBe('all')
  })

  it('не сужает область, если роли идут в обратном порядке', () => {
    const result = computeEffectivePermissions(
      roles(
        { permissionKey: 'songs.edit', scope: 'all' },
        { permissionKey: 'songs.edit', scope: 'own' },
      ),
      [],
    )
    expect(result.get('songs.edit')).toBe('all')
  })

  it('добавляет персональное разрешение сверх роли', () => {
    const result = computeEffectivePermissions(
      roles({ permissionKey: 'songs.create', scope: null }),
      personal({ permissionKey: 'songs.delete', effect: 'grant', scope: null }),
    )
    expect(hasPermission(result, 'songs.delete')).toBe(true)
  })

  it('персональное разрешение может расширить область действия', () => {
    const result = computeEffectivePermissions(
      roles({ permissionKey: 'songs.edit', scope: 'own' }),
      personal({ permissionKey: 'songs.edit', effect: 'grant', scope: 'all' }),
    )
    expect(result.get('songs.edit')).toBe('all')
  })

  // Ключевое правило модели
  it('запрет сильнее права из роли', () => {
    const result = computeEffectivePermissions(
      roles({ permissionKey: 'songs.delete', scope: null }),
      personal({ permissionKey: 'songs.delete', effect: 'deny', scope: null }),
    )
    expect(hasPermission(result, 'songs.delete')).toBe(false)
  })

  it('запрет сильнее персонального разрешения', () => {
    const result = computeEffectivePermissions(
      [],
      personal(
        { permissionKey: 'songs.delete', effect: 'grant', scope: null },
        { permissionKey: 'songs.delete', effect: 'deny', scope: null },
      ),
    )
    expect(hasPermission(result, 'songs.delete')).toBe(false)
  })

  it('запрет снимает право целиком, а не сужает область', () => {
    const result = computeEffectivePermissions(
      roles({ permissionKey: 'songs.edit', scope: 'all' }),
      personal({ permissionKey: 'songs.edit', effect: 'deny', scope: 'own' }),
    )
    expect(hasPermission(result, 'songs.edit')).toBe(false)
  })

  it('без ролей и исключений прав нет', () => {
    const result = computeEffectivePermissions([], [])
    expect(result.size).toBe(0)
  })
})

describe('проверка действия над конкретным объектом', () => {
  const ownOnly = computeEffectivePermissions(
    roles({ permissionKey: 'songs.edit', scope: 'own' }),
    [],
  )
  const anyContent = computeEffectivePermissions(
    roles({ permissionKey: 'songs.edit', scope: 'all' }),
    [],
  )
  const noScope = computeEffectivePermissions(
    roles({ permissionKey: 'songs.publish', scope: null }),
    [],
  )

  it('со своей областью разрешает свой контент', () => {
    expect(canActOn(ownOnly, 'songs.edit', ME, ME)).toBe(true)
  })

  it('со своей областью запрещает чужой контент', () => {
    expect(canActOn(ownOnly, 'songs.edit', SOMEONE_ELSE, ME)).toBe(false)
  })

  it('с полной областью разрешает чужой контент', () => {
    expect(canActOn(anyContent, 'songs.edit', SOMEONE_ELSE, ME)).toBe(true)
  })

  it('право без области действия работает везде', () => {
    expect(canActOn(noScope, 'songs.publish', SOMEONE_ELSE, ME)).toBe(true)
  })

  it('со своей областью запрещает объект без владельца', () => {
    expect(canActOn(ownOnly, 'songs.edit', null, ME)).toBe(false)
    expect(canActOn(ownOnly, 'songs.edit', undefined, ME)).toBe(false)
  })

  it('отсутствующее право запрещает всё', () => {
    expect(canActOn(ownOnly, 'songs.delete', ME, ME)).toBe(false)
  })
})
