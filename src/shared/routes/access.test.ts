import { describe, expect, it } from 'vitest'

import { isProtectedPath, requiresActiveSubscription } from './access'

describe('isProtectedPath', () => {
  it('считает закрытой саму главную закрытой зоны', () => {
    expect(isProtectedPath('/app')).toBe(true)
  })

  it('считает закрытыми вложенные адреса', () => {
    expect(isProtectedPath('/app/learn/songs')).toBe(true)
    expect(isProtectedPath('/app/manage/team')).toBe(true)
  })

  it('оставляет открытыми публичные адреса', () => {
    expect(isProtectedPath('/')).toBe(false)
    expect(isProtectedPath('/legal/offer')).toBe(false)
    expect(isProtectedPath('/auth/telegram')).toBe(false)
  })

  it('не путает похожие адреса с закрытой зоной', () => {
    expect(isProtectedPath('/application')).toBe(false)
    expect(isProtectedPath('/appointments/list')).toBe(false)
  })
})

describe('requiresActiveSubscription', () => {
  it('закрывает обучение и эфиры', () => {
    expect(requiresActiveSubscription('/app/learn')).toBe(true)
    expect(requiresActiveSubscription('/app/learn/songs')).toBe(true)
    expect(requiresActiveSubscription('/app/learn/course/module-1/lesson-2')).toBe(true)
    expect(requiresActiveSubscription('/app/streams')).toBe(true)
    expect(requiresActiveSubscription('/app/streams/efir-12')).toBe(true)
  })

  it('оставляет открытым личный кабинет', () => {
    // Прогресс и профиль — якорь для возвращения: человек должен увидеть,
    // на чём остановился, а не пустоту
    expect(requiresActiveSubscription('/app/me')).toBe(false)
    expect(requiresActiveSubscription('/app/me/progress')).toBe(false)
    expect(requiresActiveSubscription('/app/me/settings')).toBe(false)
  })

  it('оставляет открытыми страницы клуба', () => {
    expect(requiresActiveSubscription('/app/club/about')).toBe(false)
    expect(requiresActiveSubscription('/app/club/curators')).toBe(false)
  })

  it('оставляет открытыми главную и страницу продления', () => {
    // Иначе человек попал бы в кольцо перенаправлений
    expect(requiresActiveSubscription('/app')).toBe(false)
    expect(requiresActiveSubscription('/app/subscription/expired')).toBe(false)
  })

  it('не путает раздел с похожим по началу адресом', () => {
    expect(requiresActiveSubscription('/app/learning-materials')).toBe(false)
  })
})
