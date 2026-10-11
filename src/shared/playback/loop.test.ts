import { describe, expect, it } from 'vitest'

import { clampLoop, loopFromSection, makeLoop, MIN_LOOP_SECONDS, shouldRestartLoop } from './loop'

describe('makeLoop', () => {
  it('собирает отрезок из двух отметок', () => {
    expect(makeLoop(10, 20)).toEqual({ from: 10, to: 20 })
  })

  it('порядок отметок не важен: B можно поставить раньше A', () => {
    expect(makeLoop(20, 10)).toEqual({ from: 10, to: 20 })
  })

  it('слишком короткий отрезок — это не отрезок', () => {
    expect(makeLoop(10, 10 + MIN_LOOP_SECONDS - 0.1)).toBeNull()
    expect(makeLoop(10, 10)).toBeNull()
  })

  it('отрицательное начало подтягивается к нулю', () => {
    expect(makeLoop(-5, 10)).toEqual({ from: 0, to: 10 })
  })
})

describe('shouldRestartLoop', () => {
  const loop = { from: 10, to: 20 }

  it('без отрезка не перезапускает никогда', () => {
    expect(shouldRestartLoop(999, null)).toBe(false)
  })

  it('внутри отрезка не трогает', () => {
    expect(shouldRestartLoop(15, loop)).toBe(false)
  })

  it('срабатывает чуть раньше конца, а не после него', () => {
    expect(shouldRestartLoop(19.7, loop)).toBe(false)
    expect(shouldRestartLoop(19.8, loop)).toBe(true)
    expect(shouldRestartLoop(20.5, loop)).toBe(true)
  })

  it('не тянет вперёд человека, отмотавшего назад сам', () => {
    expect(shouldRestartLoop(3, loop)).toBe(false)
  })
})

describe('clampLoop', () => {
  it('без известной длительности оставляет как есть', () => {
    expect(clampLoop({ from: 10, to: 20 }, null)).toEqual({ from: 10, to: 20 })
  })

  it('подрезает конец по длительности записи', () => {
    expect(clampLoop({ from: 10, to: 900 }, 30)).toEqual({ from: 10, to: 30 })
  })

  it('отрезок целиком за пределами записи исчезает', () => {
    expect(clampLoop({ from: 100, to: 200 }, 30)).toBeNull()
  })
})

describe('loopFromSection', () => {
  it('часть с началом и концом даёт отрезок', () => {
    expect(loopFromSection({ startSec: 30, endSec: 90 })).toEqual({ from: 30, to: 90 })
  })

  it('часть со своим роликом отрезка не даёт', () => {
    expect(loopFromSection({ startSec: null, endSec: null })).toBeNull()
    expect(loopFromSection({ startSec: 30, endSec: null })).toBeNull()
  })
})
