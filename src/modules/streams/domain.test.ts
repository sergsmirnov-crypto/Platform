import { describe, expect, it } from 'vitest'

import { canJoin, formatDuration, isUpcoming, streamPhase, timeUntil } from './domain'

/**
 * Тесты правил эфиров.
 *
 * Главное здесь — подстраховка от забывчивости куратора. Он закончит
 * эфир и уйдёт спать, не переключив состояние; платформа не должна
 * до утра обещать участникам трансляцию.
 */

const NOW = new Date('2026-08-12T19:00:00Z')

function at(offsetMinutes: number): Date {
  return new Date(NOW.getTime() + offsetMinutes * 60000)
}

function stream(overrides: Partial<Parameters<typeof streamPhase>[0]> = {}) {
  return {
    state: 'scheduled' as const,
    startsAt: at(60),
    endedAt: null,
    hasVideo: false,
    ...overrides,
  }
}

describe('streamPhase', () => {
  it('запланированный в будущем — ближайший', () => {
    expect(streamPhase(stream(), NOW)).toBe('upcoming')
  })

  it('запланированный, но время прошло — закончился', () => {
    // Куратор не переключил состояние вовсе
    expect(streamPhase(stream({ startsAt: at(-30) }), NOW)).toBe('finished')
  })

  it('идёт сейчас', () => {
    expect(streamPhase(stream({ state: 'live', startsAt: at(-20) }), NOW)).toBe('live')
  })

  it('«идёт» третьи сутки — считаем законченным', () => {
    // Забыл переключить: вечная кнопка «присоединиться» вела бы
    // в пустую комнату
    expect(streamPhase(stream({ state: 'live', startsAt: at(-4 * 60) }), NOW)).toBe('finished')
  })

  it('появилось видео — эфир точно прошёл, что бы ни стояло в поле', () => {
    expect(streamPhase(stream({ state: 'live', hasVideo: true }), NOW)).toBe('recorded')
    expect(streamPhase(stream({ state: 'scheduled', hasVideo: true }), NOW)).toBe('recorded')
  })

  it('отменённый остаётся отменённым даже с видео', () => {
    expect(streamPhase(stream({ state: 'cancelled', hasVideo: true }), NOW)).toBe('cancelled')
  })

  it('отмечен как прошедший, но записи ещё нет', () => {
    expect(streamPhase(stream({ state: 'recorded', startsAt: at(-120) }), NOW)).toBe('finished')
  })
})

describe('isUpcoming', () => {
  it('ближайшие — это и запланированные, и идущие', () => {
    expect(isUpcoming('upcoming')).toBe(true)
    expect(isUpcoming('live')).toBe(true)
  })

  it('всё остальное — архив', () => {
    for (const phase of ['finished', 'recorded', 'cancelled'] as const) {
      expect(isUpcoming(phase)).toBe(false)
    }
  })
})

describe('canJoin', () => {
  const url = 'https://t.me/example'

  it('во время эфира — можно', () => {
    expect(canJoin({ joinUrl: url, startsAt: at(-10) }, 'live', NOW)).toBe(true)
  })

  it('за десять минут до начала — уже можно', () => {
    // Люди приходят заранее, «ещё нельзя» выглядит как поломка
    expect(canJoin({ joinUrl: url, startsAt: at(10) }, 'upcoming', NOW)).toBe(true)
  })

  it('за час — ещё нет', () => {
    expect(canJoin({ joinUrl: url, startsAt: at(60) }, 'upcoming', NOW)).toBe(false)
  })

  it('без ссылки присоединяться некуда', () => {
    expect(canJoin({ joinUrl: null, startsAt: at(-10) }, 'live', NOW)).toBe(false)
  })

  it('к записи не присоединяются', () => {
    expect(canJoin({ joinUrl: url, startsAt: at(-600) }, 'recorded', NOW)).toBe(false)
  })
})

describe('timeUntil', () => {
  it('минуты, часы и дни', () => {
    expect(timeUntil(at(30), NOW)).toBe('через 30 мин')
    expect(timeUntil(at(120), NOW)).toBe('через 2 часа')
    expect(timeUntil(at(48 * 60), NOW)).toBe('через 2 дня')
  })

  it('склоняет по-русски', () => {
    expect(timeUntil(at(60), NOW)).toBe('через 1 час')
    expect(timeUntil(at(5 * 60), NOW)).toBe('через 5 часов')
    expect(timeUntil(at(11 * 24 * 60), NOW)).toBe('через 11 дней')
    expect(timeUntil(at(21 * 24 * 60), NOW)).toBe('через 21 день')
  })

  it('вот-вот начнётся', () => {
    expect(timeUntil(at(0), NOW)).toBe('начинается')
  })

  it('прошедшему времени до начала нет', () => {
    expect(timeUntil(at(-5), NOW)).toBeNull()
  })
})

describe('formatDuration', () => {
  it('часы и минуты', () => {
    expect(formatDuration(92 * 60)).toBe('1 ч 32 мин')
    expect(formatDuration(45 * 60)).toBe('45 мин')
    expect(formatDuration(120 * 60)).toBe('2 ч')
  })

  it('неизвестной длительности нет', () => {
    expect(formatDuration(null)).toBeNull()
    expect(formatDuration(0)).toBeNull()
  })
})
