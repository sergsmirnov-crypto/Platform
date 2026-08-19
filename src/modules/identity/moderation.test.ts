import { describe, expect, it } from 'vitest'

import { blockReasonLabel, blockReasonSchema, checkCanBlock, checkCanUnblock } from './moderation'

import type { ModerationTarget } from './moderation'

const ACTOR = '11111111-1111-1111-1111-111111111111'
const TARGET = '22222222-2222-2222-2222-222222222222'

function target(overrides: Partial<ModerationTarget> = {}): ModerationTarget {
  return { userId: TARGET, isOwner: false, isBlocked: false, ...overrides }
}

describe('блокировка участника', () => {
  it('обычного участника заблокировать можно', () => {
    expect(checkCanBlock(ACTOR, target())).toEqual({ allowed: true })
  })

  it('себя заблокировать нельзя', () => {
    const verdict = checkCanBlock(ACTOR, target({ userId: ACTOR }))

    expect(verdict.allowed).toBe(false)
  })

  it('владельца платформы заблокировать нельзя', () => {
    const verdict = checkCanBlock(ACTOR, target({ isOwner: true }))

    expect(verdict.allowed).toBe(false)
  })

  it('повторная блокировка запрещена: она затёрла бы исходную причину', () => {
    const verdict = checkCanBlock(ACTOR, target({ isBlocked: true }))

    expect(verdict.allowed).toBe(false)
  })

  it('запрет «нельзя себя» действует и для владельца', () => {
    const verdict = checkCanBlock(ACTOR, target({ userId: ACTOR, isOwner: true }))

    expect(verdict.allowed).toBe(false)
  })
})

describe('снятие блокировки', () => {
  it('с заблокированного снять можно', () => {
    expect(checkCanUnblock(target({ isBlocked: true }))).toEqual({ allowed: true })
  })

  it('с незаблокированного снимать нечего', () => {
    expect(checkCanUnblock(target()).allowed).toBe(false)
  })
})

describe('причина блокировки', () => {
  it('пустая причина не принимается', () => {
    expect(blockReasonSchema.safeParse('   ').success).toBe(false)
  })

  it('слишком короткая причина не принимается', () => {
    expect(blockReasonSchema.safeParse('спам').success).toBe(false)
  })

  it('осмысленная причина принимается и обрезается по краям', () => {
    const parsed = blockReasonSchema.safeParse('  рассылка спама в чате  ')

    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data).toBe('рассылка спама в чате')
  })

  it('слишком длинная причина не принимается', () => {
    expect(blockReasonSchema.safeParse('я'.repeat(501)).success).toBe(false)
  })

  it('отсутствующая причина показывается понятной строкой', () => {
    expect(blockReasonLabel(null)).toBe('Причина не указана')
    expect(blockReasonLabel('  ')).toBe('Причина не указана')
    expect(blockReasonLabel('спам')).toBe('спам')
  })
})
