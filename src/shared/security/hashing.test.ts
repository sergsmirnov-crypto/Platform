import { describe, expect, it } from 'vitest'

import { generateToken, hashWithSecret } from './hashing'

const SECRET = 'test-secret-not-less-than-32-characters-long'

describe('generateToken', () => {
  it('выдаёт разные значения при каждом вызове', () => {
    const values = new Set(Array.from({ length: 100 }, () => generateToken()))

    expect(values.size).toBe(100)
  })

  it('не содержит символов, требующих экранирования в cookie и адресах', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateToken()).toMatch(/^[A-Za-z0-9_-]+$/)
    }
  })

  it('даёт 256 бит случайности по умолчанию', () => {
    // 32 байта в base64url — это 43 символа без выравнивающих знаков
    expect(generateToken()).toHaveLength(43)
  })
})

describe('hashWithSecret', () => {
  it('для одного значения всегда даёт один хеш', () => {
    expect(hashWithSecret('ключ-сессии', SECRET)).toBe(hashWithSecret('ключ-сессии', SECRET))
  })

  it('для разных значений даёт разные хеши', () => {
    expect(hashWithSecret('первый', SECRET)).not.toBe(hashWithSecret('второй', SECRET))
  })

  it('с другим секретом даёт другой хеш', () => {
    // Смысл секрета: имея копию базы, но не зная секрет,
    // проверить догадку о значении невозможно
    expect(hashWithSecret('одно и то же', SECRET)).not.toBe(
      hashWithSecret('одно и то же', 'другой секрет'),
    )
  })

  it('не раскрывает исходное значение', () => {
    const hash = hashWithSecret('192.168.0.1', SECRET)

    expect(hash).not.toContain('192')
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('отказывается работать без секрета', () => {
    expect(() => hashWithSecret('значение', '')).toThrow(/SESSION_SECRET/)
  })
})
