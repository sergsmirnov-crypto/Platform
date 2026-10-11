import { describe, expect, it } from 'vitest'

import {
  beatInterval,
  beatsInWindow,
  clampBpm,
  defaultBpm,
  isAccent,
  MAX_BPM,
  MIN_BPM,
} from './metronome'

describe('clampBpm', () => {
  it('держит темп в границах', () => {
    expect(clampBpm(10)).toBe(MIN_BPM)
    expect(clampBpm(1000)).toBe(MAX_BPM)
    expect(clampBpm(120)).toBe(120)
  })

  it('дробное округляется, мусор превращается в разумное значение', () => {
    expect(clampBpm(120.6)).toBe(121)
    expect(clampBpm(Number.NaN)).toBe(100)
  })
})

describe('beatInterval', () => {
  it('при 120 ударах доля длится полсекунды', () => {
    expect(beatInterval(120)).toBeCloseTo(0.5)
  })

  it('при 60 ударах — секунду', () => {
    expect(beatInterval(60)).toBeCloseTo(1)
  })
})

describe('isAccent', () => {
  it('первая доля такта сильная', () => {
    expect(isAccent(0, 4)).toBe(true)
    expect(isAccent(4, 4)).toBe(true)
  })

  it('остальные слабые', () => {
    expect(isAccent(1, 4)).toBe(false)
    expect(isAccent(3, 4)).toBe(false)
  })

  it('на три четверти сильная каждая третья', () => {
    expect(isAccent(3, 3)).toBe(true)
    expect(isAccent(4, 3)).toBe(false)
  })
})

describe('beatsInWindow', () => {
  it('заполняет окно долями', () => {
    const beats = beatsInWindow(0, 1, 0, 120)

    expect(beats.map((beat) => beat.index)).toEqual([0, 1, 2])
    expect(beats[1]?.time).toBeCloseTo(0.5)
  })

  it('не выдаёт доли, которые уже прозвучали', () => {
    const beats = beatsInWindow(1, 2, 0, 120)

    expect(beats[0]?.index).toBe(2)
    expect(beats[0]?.time).toBeCloseTo(1)
  })

  it('пустое окно — пустой список, а не ошибка', () => {
    expect(beatsInWindow(2, 1, 0, 120)).toEqual([])
  })

  it('индексы считаются от начала, а не от окна: акценты не съезжают', () => {
    const beats = beatsInWindow(10, 10.6, 0, 120)

    // 10 секунд при 120 ударах — это ровно 20-я доля
    expect(beats[0]?.index).toBe(20)
  })
})

describe('defaultBpm', () => {
  it('берёт темп песни', () => {
    expect(defaultBpm(72)).toBe(72)
  })

  it('без темпа даёт середину диапазона, а не пустоту', () => {
    expect(defaultBpm(null)).toBe(100)
  })
})
