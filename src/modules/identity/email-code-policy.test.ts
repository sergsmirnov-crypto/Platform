import { describe, expect, it } from 'vitest'

import {
  canIssueCode,
  checkCode,
  cleanCodeInput,
  codeExpiry,
  codeMatches,
  generateCode,
  hashCode,
} from './email-code-policy'

import type { StoredCode } from './email-code-policy'

const SECRET = 's'.repeat(32)
const NOW = new Date('2026-10-08T10:00:00Z')
const LIMITS = { resendCooldownSeconds: 60, maxCodesPerHour: 5 }

function stored(overrides: Partial<StoredCode> = {}, code = '123456'): StoredCode {
  const id = overrides.id ?? 'code-1'

  return {
    id,
    codeHash: hashCode(code, id, SECRET),
    attempts: 0,
    expiresAt: new Date(NOW.getTime() + 10 * 60 * 1000),
    consumedAt: null,
    ...overrides,
  }
}

const context = { secret: SECRET, maxAttempts: 5, now: NOW }

describe('generateCode', () => {
  it('выдаёт ровно столько цифр, сколько нужно, включая ведущие нули', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateCode(6)).toMatch(/^\d{6}$/)
    }
  })
})

describe('hashCode и codeMatches', () => {
  it('принимает верный код', () => {
    expect(codeMatches('123456', stored(), SECRET)).toBe(true)
  })

  it('отклоняет неверный код', () => {
    expect(codeMatches('654321', stored(), SECRET)).toBe(false)
  })

  it('код одной записи не подходит к другой: в хеш входит идентификатор', () => {
    const other = stored({ id: 'code-2' })

    expect(other.codeHash).not.toBe(stored().codeHash)
  })

  it('без секрета приложения хеш не совпадёт', () => {
    expect(codeMatches('123456', stored(), 'x'.repeat(32))).toBe(false)
  })
})

describe('cleanCodeInput', () => {
  it('убирает пробелы и дефисы, которые появляются при вставке', () => {
    expect(cleanCodeInput(' 123 456 ')).toBe('123456')
    expect(cleanCodeInput('123-456')).toBe('123456')
  })
})

describe('canIssueCode', () => {
  it('первый код — без ограничений', () => {
    expect(canIssueCode({ lastIssuedAt: null, issuedLastHour: 0 }, LIMITS, NOW)).toEqual({
      ok: true,
    })
  })

  it('повтор раньше минуты отклоняется и говорит, сколько ждать', () => {
    const decision = canIssueCode(
      { lastIssuedAt: new Date(NOW.getTime() - 20_000), issuedLastHour: 1 },
      LIMITS,
      NOW,
    )

    expect(decision).toEqual({ ok: false, reason: 'cooldown', retryAfterSeconds: 40 })
  })

  it('через минуту повтор разрешён', () => {
    const decision = canIssueCode(
      { lastIssuedAt: new Date(NOW.getTime() - 60_000), issuedLastHour: 1 },
      LIMITS,
      NOW,
    )

    expect(decision.ok).toBe(true)
  })

  it('пятый код за час — последний', () => {
    const decision = canIssueCode({ lastIssuedAt: null, issuedLastHour: 5 }, LIMITS, NOW)

    expect(decision).toEqual({ ok: false, reason: 'hourly_limit' })
  })
})

describe('checkCode', () => {
  it('верный код с первой попытки', () => {
    expect(checkCode(stored(), '123456', 1, context)).toEqual({ ok: true })
  })

  it('кода нет вовсе', () => {
    expect(checkCode(null, '123456', 0, context)).toEqual({ ok: false, reason: 'missing' })
  })

  it('погашенный код не принимается, даже верный', () => {
    expect(checkCode(stored({ consumedAt: NOW }), '123456', 1, context)).toEqual({
      ok: false,
      reason: 'missing',
    })
  })

  it('истёкший код не принимается, даже верный', () => {
    expect(checkCode(stored({ expiresAt: NOW }), '123456', 1, context)).toEqual({
      ok: false,
      reason: 'expired',
    })
  })

  it('неверный код сообщает, сколько попыток осталось', () => {
    expect(checkCode(stored(), '000000', 2, context)).toEqual({
      ok: false,
      reason: 'wrong',
      attemptsLeft: 3,
    })
  })

  it('пятая неверная попытка сжигает код', () => {
    expect(checkCode(stored(), '000000', 5, context)).toEqual({ ok: false, reason: 'exhausted' })
  })

  it('после исчерпания попыток не принимается даже верный код', () => {
    // Иначе перебор продолжался бы бесконечно: шестая попытка с верным
    // кодом открыла бы вход, хотя код должен был сгореть
    expect(checkCode(stored(), '123456', 6, context)).toEqual({ ok: false, reason: 'exhausted' })
  })
})

describe('codeExpiry', () => {
  it('добавляет срок действия в минутах', () => {
    expect(codeExpiry(NOW, 10)).toEqual(new Date('2026-10-08T10:10:00Z'))
  })
})
