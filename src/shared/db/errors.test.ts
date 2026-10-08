import { describe, expect, it } from 'vitest'

import { isUniqueViolation } from './errors'

describe('isUniqueViolation', () => {
  it('узнаёт ошибку драйвера', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true)
  })

  it('узнаёт ошибку, обёрнутую Drizzle', () => {
    expect(isUniqueViolation(new Error('query failed', { cause: { code: '23505' } }))).toBe(true)
  })

  it('не путает с другими ошибками базы', () => {
    expect(isUniqueViolation({ code: '57P01' })).toBe(false)
    expect(isUniqueViolation(new Error('connection refused'))).toBe(false)
    expect(isUniqueViolation(null)).toBe(false)
  })
})
