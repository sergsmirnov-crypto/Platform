import { describe, expect, it } from 'vitest'

import { isNavItemActive, MAIN_NAV, MANAGE_NAV } from './navigation'

describe('isNavItemActive', () => {
  it('подсвечивает раздел на его собственной странице', () => {
    expect(isNavItemActive('/app/learn', '/app/learn')).toBe(true)
  })

  it('подсвечивает раздел на вложенных страницах', () => {
    expect(isNavItemActive('/app/learn', '/app/learn/songs')).toBe(true)
    expect(isNavItemActive('/app/learn', '/app/learn/course/module-1/lesson-2')).toBe(true)
  })

  it('не подсвечивает главную на других страницах', () => {
    // Адрес главной совпадает по началу со всеми остальными,
    // поэтому для неё нужно точное равенство
    expect(isNavItemActive('/app', '/app/learn/songs')).toBe(false)
    expect(isNavItemActive('/app', '/app')).toBe(true)
  })

  it('не путает разделы с похожим началом адреса', () => {
    expect(isNavItemActive('/app/streams', '/app/streams-archive')).toBe(false)
  })

  it('не подсвечивает чужой раздел', () => {
    expect(isNavItemActive('/app/learn', '/app/streams')).toBe(false)
  })
})

describe('структура навигации', () => {
  it('содержит ровно пять пунктов: больше не помещается в мобильный таб-бар', () => {
    expect(MAIN_NAV).toHaveLength(5)
  })

  it('у каждого пункта есть короткая подпись для телефона', () => {
    for (const item of MAIN_NAV) {
      expect(item.shortLabel.length).toBeGreaterThan(0)
      expect(item.shortLabel.length).toBeLessThanOrEqual(9)
    }
  })

  it('все адреса уникальны', () => {
    const hrefs = MAIN_NAV.map((item) => item.href)

    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('обзор управления виден всем, у кого есть доступ в раздел', () => {
    expect(MANAGE_NAV[0]?.permission).toBeUndefined()
  })

  it('каждый пункт управления, кроме обзора, требует права', () => {
    for (const item of MANAGE_NAV.slice(1)) {
      expect(item.permission).toBeTruthy()
    }
  })
})
