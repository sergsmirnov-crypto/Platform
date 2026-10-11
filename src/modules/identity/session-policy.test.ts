import { describe, expect, it } from 'vitest'

import {
  computeExpiry,
  isSessionUsable,
  pickSessionsToRevoke,
  shouldExtend,
} from './session-policy'

import type { SessionTiming } from './session-policy'

const NOW = new Date('2026-08-07T12:00:00Z')
const minutes = (n: number) => n * 60 * 1000
const days = (n: number) => n * 24 * 60 * 60 * 1000

function session(overrides: Partial<SessionTiming> = {}): SessionTiming {
  return {
    createdAt: new Date(NOW.getTime() - days(1)),
    lastUsedAt: new Date(NOW.getTime() - minutes(5)),
    expiresAt: new Date(NOW.getTime() + days(89)),
    revokedAt: null,
    ...overrides,
  }
}

describe('isSessionUsable', () => {
  it('пропускает действующую сессию', () => {
    expect(isSessionUsable(session(), NOW)).toBe(true)
  })

  it('не пропускает отозванную сессию', () => {
    // Выход с устройства должен действовать немедленно — это главное,
    // ради чего выбраны серверные сессии вместо JWT (ADR-0003)
    const revoked = session({ revokedAt: new Date(NOW.getTime() - minutes(1)) })

    expect(isSessionUsable(revoked, NOW)).toBe(false)
  })

  it('не пропускает отозванную сессию, даже если срок ещё не истёк', () => {
    const revoked = session({
      revokedAt: new Date(NOW.getTime() - minutes(1)),
      expiresAt: new Date(NOW.getTime() + days(89)),
    })

    expect(isSessionUsable(revoked, NOW)).toBe(false)
  })

  it('не пропускает истёкшую сессию', () => {
    expect(isSessionUsable(session({ expiresAt: new Date(NOW.getTime() - 1) }), NOW)).toBe(false)
  })

  it('считает момент истечения концом срока, а не последней секундой', () => {
    expect(isSessionUsable(session({ expiresAt: NOW }), NOW)).toBe(false)
  })
})

describe('computeExpiry', () => {
  it('отсчитывает срок от текущего момента', () => {
    expect(computeExpiry(NOW, 90)).toEqual(new Date(NOW.getTime() + days(90)))
  })

  it('работает с коротким сроком', () => {
    expect(computeExpiry(NOW, 1)).toEqual(new Date(NOW.getTime() + days(1)))
  })
})

describe('shouldExtend', () => {
  it('не продлевает сессию, использованную только что', () => {
    // Иначе каждая открытая страница означала бы запись в базу
    const fresh = session({ lastUsedAt: new Date(NOW.getTime() - minutes(1)) })

    expect(shouldExtend(fresh, NOW, minutes(60))).toBe(false)
  })

  it('продлевает сессию, не использованную дольше промежутка', () => {
    const old = session({ lastUsedAt: new Date(NOW.getTime() - minutes(61)) })

    expect(shouldExtend(old, NOW, minutes(60))).toBe(true)
  })

  it('продлевает ровно на границе промежутка', () => {
    const edge = session({ lastUsedAt: new Date(NOW.getTime() - minutes(60)) })

    expect(shouldExtend(edge, NOW, minutes(60))).toBe(true)
  })
})

describe('pickSessionsToRevoke', () => {
  const device = (id: string, minutesAgo: number) => ({
    id,
    lastUsedAt: new Date(NOW.getTime() - minutes(minutesAgo)),
  })

  it('ничего не закрывает, пока есть свободное место', () => {
    expect(pickSessionsToRevoke([device('a', 10), device('b', 20)], 3)).toEqual([])
  })

  it('закрывает самую давнюю сессию, когда лимит исчерпан', () => {
    const existing = [device('свежая', 1), device('средняя', 30), device('давняя', 500)]

    expect(pickSessionsToRevoke(existing, 3)).toEqual(['давняя'])
  })

  it('оставляет место новому устройству', () => {
    // Три устройства разрешено: после входа с четвёртого
    // должны остаться две старые сессии и одна новая
    const existing = [device('a', 1), device('b', 2), device('c', 3)]

    expect(pickSessionsToRevoke(existing, 3)).toHaveLength(1)
  })

  it('закрывает сразу несколько, если сессий накопилось больше нормы', () => {
    const existing = [
      device('a', 1),
      device('b', 2),
      device('c', 3),
      device('d', 4),
      device('e', 5),
    ]

    expect(pickSessionsToRevoke(existing, 3)).toEqual(['c', 'd', 'e'])
  })

  it('не трогает устройство, за которым человек сидит прямо сейчас', () => {
    const existing = [
      device('текущее', 0),
      device('вчерашнее', 1440),
      device('позавчерашнее', 2880),
    ]

    expect(pickSessionsToRevoke(existing, 3)).not.toContain('текущее')
  })

  it('не изменяет переданный список', () => {
    const existing = [device('a', 100), device('b', 1), device('c', 50)]
    const before = existing.map((item) => item.id)

    pickSessionsToRevoke(existing, 2)

    expect(existing.map((item) => item.id)).toEqual(before)
  })

  it('закрывает всё при лимите в одно устройство', () => {
    const existing = [device('a', 1), device('b', 2)]

    expect(pickSessionsToRevoke(existing, 1)).toEqual(['a', 'b'])
  })
})
