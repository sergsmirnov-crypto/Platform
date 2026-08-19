import { beforeEach, describe, expect, it } from 'vitest'

import { checkRateLimit, resetRateLimits } from './rate-limit'

describe('ограничение частоты запросов', () => {
  beforeEach(() => resetRateLimits())

  const options = { action: 'login', subject: 'user-1', limit: 3, windowSeconds: 60 }

  it('пропускает попытки в пределах лимита', () => {
    expect(checkRateLimit(options).allowed).toBe(true)
    expect(checkRateLimit(options).allowed).toBe(true)
    expect(checkRateLimit(options).allowed).toBe(true)
  })

  it('отклоняет попытку сверх лимита', () => {
    checkRateLimit(options)
    checkRateLimit(options)
    checkRateLimit(options)
    expect(checkRateLimit(options).allowed).toBe(false)
  })

  it('считает разных людей отдельно', () => {
    checkRateLimit(options)
    checkRateLimit(options)
    checkRateLimit(options)
    expect(checkRateLimit({ ...options, subject: 'user-2' }).allowed).toBe(true)
  })

  it('считает разные действия отдельно', () => {
    checkRateLimit(options)
    checkRateLimit(options)
    checkRateLimit(options)
    expect(checkRateLimit({ ...options, action: 'search' }).allowed).toBe(true)
  })

  it('сообщает, сколько попыток осталось', () => {
    expect(checkRateLimit(options).remaining).toBe(2)
    expect(checkRateLimit(options).remaining).toBe(1)
    expect(checkRateLimit(options).remaining).toBe(0)
  })
})
