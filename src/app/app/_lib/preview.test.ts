import { describe, expect, it } from 'vitest'

import type { EffectivePermissions } from '@/modules/access'

import {
  isManagePath,
  isPreviewRequested,
  maskPermissions,
  pathAfterPreviewChange,
  resolvePreviewState,
} from './preview'

/**
 * Тесты режима «смотреть как участник».
 *
 * Проверяется главное свойство модели: режим только отнимает права.
 * Если этот файл когда-нибудь начнёт падать на проверке «маска не добавляет
 * прав» — значит, кто-то сделал из безобидной cookie дыру в доступе.
 */

const CURATOR_PERMISSIONS: EffectivePermissions = new Map([
  ['songs.edit', 'own'],
  ['songs.publish', null],
])

describe('isPreviewRequested', () => {
  it('распознаёт включённый режим', () => {
    expect(isPreviewRequested('1')).toBe(true)
  })

  it('любое другое значение режимом не является', () => {
    expect(isPreviewRequested('true')).toBe(false)
    expect(isPreviewRequested('0')).toBe(false)
    expect(isPreviewRequested('')).toBe(false)
    expect(isPreviewRequested(undefined)).toBe(false)
    expect(isPreviewRequested(null)).toBe(false)
  })
})

describe('resolvePreviewState', () => {
  it('включается у того, кому есть что скрывать', () => {
    expect(resolvePreviewState({ requested: true, hasRealPermissions: true })).toBe(true)
  })

  it('не включается у обычного участника, даже если cookie осталась', () => {
    expect(resolvePreviewState({ requested: true, hasRealPermissions: false })).toBe(false)
  })

  it('не включается без запроса', () => {
    expect(resolvePreviewState({ requested: false, hasRealPermissions: true })).toBe(false)
  })
})

describe('maskPermissions', () => {
  it('вне режима права остаются нетронутыми', () => {
    expect(maskPermissions(CURATOR_PERMISSIONS, false)).toBe(CURATOR_PERMISSIONS)
  })

  it('в режиме прав не остаётся вовсе', () => {
    expect(maskPermissions(CURATOR_PERMISSIONS, true).size).toBe(0)
  })

  it('маска не может добавить право, которого не было', () => {
    const masked = maskPermissions(new Map(), true)
    expect(masked.size).toBe(0)
    expect(masked.has('users.roles')).toBe(false)
  })
})

describe('isManagePath', () => {
  it('узнаёт раздел управления и его вложенные страницы', () => {
    expect(isManagePath('/app/manage')).toBe(true)
    expect(isManagePath('/app/manage/songs')).toBe(true)
  })

  it('не путает с похожими адресами', () => {
    expect(isManagePath('/app/learn/songs')).toBe(false)
    expect(isManagePath('/app/manageable')).toBe(false)
  })
})

describe('pathAfterPreviewChange', () => {
  it('возвращает на ту же страницу', () => {
    expect(pathAfterPreviewChange('/app/learn/songs', true)).toBe('/app/learn/songs')
  })

  it('при входе в режим уводит из управления на главную', () => {
    expect(pathAfterPreviewChange('/app/manage/songs', true)).toBe('/app')
  })

  it('при выходе из режима возвращает в управление', () => {
    expect(pathAfterPreviewChange('/app/manage/songs', false)).toBe('/app/manage/songs')
  })

  it('не уводит на чужой сайт', () => {
    expect(pathAfterPreviewChange('https://похожий-сайт.ru', true)).toBe('/app')
    expect(pathAfterPreviewChange('//похожий-сайт.ru', true)).toBe('/app')
  })

  it('без адреса ведёт на главную', () => {
    expect(pathAfterPreviewChange(null, true)).toBe('/app')
  })
})
