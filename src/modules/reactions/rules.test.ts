import { describe, expect, it } from 'vitest'

import { applyReaction, buildSummary, EMPTY_SUMMARY, isReactionKey, nextReaction } from './rules'

describe('isReactionKey', () => {
  it('узнаёт реакции из набора', () => {
    expect(isReactionKey('fire')).toBe(true)
    expect(isReactionKey('plus_one')).toBe(true)
  })

  it.each(['', 'FIRE', 'poop', null, 42])('не принимает чужое: %s', (value) => {
    expect(isReactionKey(value)).toBe(false)
  })
})

describe('buildSummary', () => {
  it('складывает счётчики в порядке набора, а не в порядке строк', () => {
    const summary = buildSummary(
      [
        { emoji: 'rocket', count: 1 },
        { emoji: 'heart', count: 3 },
        { emoji: 'fire', count: 2 },
      ],
      'fire',
    )

    expect(summary.counts.map((item) => item.key)).toEqual(['heart', 'fire', 'rocket'])
    expect(summary.total).toBe(6)
    expect(summary.mine).toBe('fire')
  })

  it('отбрасывает реакции, которых больше нет в наборе', () => {
    const summary = buildSummary(
      [
        { emoji: 'heart', count: 1 },
        { emoji: 'старая', count: 5 },
      ],
      'старая',
    )

    expect(summary.counts).toEqual([{ key: 'heart', count: 1 }])
    expect(summary.total).toBe(1)
    expect(summary.mine).toBeNull()
  })

  it('не показывает нулевые счётчики', () => {
    expect(buildSummary([{ emoji: 'heart', count: 0 }], null)).toEqual(EMPTY_SUMMARY)
  })
})

describe('applyReaction', () => {
  const base = buildSummary(
    [
      { emoji: 'heart', count: 2 },
      { emoji: 'fire', count: 1 },
    ],
    null,
  )

  it('добавляет реакцию тому, у кого её не было', () => {
    const next = applyReaction(base, 'fire')

    expect(next.counts).toEqual([
      { key: 'heart', count: 2 },
      { key: 'fire', count: 2 },
    ])
    expect(next.mine).toBe('fire')
    expect(next.total).toBe(4)
  })

  it('заменяет прежнюю реакцию: одна от человека', () => {
    const mine = applyReaction(base, 'heart')
    const changed = applyReaction(mine, 'rocket')

    expect(changed.counts).toEqual([
      { key: 'heart', count: 2 },
      { key: 'fire', count: 1 },
      { key: 'rocket', count: 1 },
    ])
    expect(changed.total).toBe(4)
  })

  it('снимает реакцию и убирает опустевший счётчик', () => {
    const mine = applyReaction(EMPTY_SUMMARY, 'party')

    expect(applyReaction(mine, null)).toEqual(EMPTY_SUMMARY)
  })

  it('ничего не меняет, если выбрана та же реакция', () => {
    const mine = applyReaction(base, 'heart')

    expect(applyReaction(mine, 'heart')).toBe(mine)
  })
})

describe('nextReaction', () => {
  it('снимает реакцию повторным нажатием', () => {
    expect(nextReaction('fire', 'fire')).toBeNull()
  })

  it('ставит другую вместо прежней', () => {
    expect(nextReaction('fire', 'heart')).toBe('heart')
    expect(nextReaction(null, 'heart')).toBe('heart')
  })
})
