import { describe, expect, it } from 'vitest'

import {
  buildLogQuery,
  DEFAULT_LOG_FILTERS,
  hasActiveLogFilters,
  parseLogFilters,
  periodStart,
} from './log-filters'

/**
 * Проверяется одно свойство: что бы ни пришло в адресной строке,
 * получается пригодный отбор, а не исключение. Адрес правит кто угодно,
 * а страница управления должна открываться всегда.
 */

describe('parseLogFilters', () => {
  it('пустой адрес даёт значения по умолчанию', () => {
    expect(parseLogFilters({})).toEqual(DEFAULT_LOG_FILTERS)
  })

  it('неизвестный раздел и период отбрасываются, а не ломают страницу', () => {
    const filters = parseLogFilters({ group: 'хмм', period: 'вчера' })

    expect(filters.group).toBeNull()
    expect(filters.period).toBe(DEFAULT_LOG_FILTERS.period)
  })

  it('отрицательная и нечисловая страница — это первая страница', () => {
    expect(parseLogFilters({ page: '-3' }).page).toBe(1)
    expect(parseLogFilters({ page: 'две' }).page).toBe(1)
    expect(parseLogFilters({ page: '4' }).page).toBe(4)
  })

  it('ссылка на объект разбирается на тип и идентификатор', () => {
    expect(parseLogFilters({ entity: 'song:7f3a-11' }).entity).toEqual({
      type: 'song',
      id: '7f3a-11',
    })
  })

  it('испорченная ссылка на объект отбрасывается', () => {
    expect(parseLogFilters({ entity: 'song' }).entity).toBeNull()
    expect(parseLogFilters({ entity: ':7f3a' }).entity).toBeNull()
    expect(parseLogFilters({ entity: 'song:' }).entity).toBeNull()
    expect(parseLogFilters({ entity: `song:${'x'.repeat(200)}` }).entity).toBeNull()
  })

  it('берётся первое значение, если параметр пришёл дважды', () => {
    expect(parseLogFilters({ group: ['songs', 'streams'] }).group).toBe('songs')
  })
})

describe('buildLogQuery', () => {
  it('значения по умолчанию в адрес не попадают', () => {
    expect(buildLogQuery(DEFAULT_LOG_FILTERS)).toBe('')
  })

  it('адрес переживает разбор и обратную сборку без потерь', () => {
    const filters = parseLogFilters({
      q: 'Metallica',
      group: 'songs',
      period: 'week',
      actor: 'a1',
      entity: 'song:s1',
      page: '3',
    })

    expect(parseLogFilters(paramsOf(buildLogQuery(filters)))).toEqual(filters)
  })
})

describe('hasActiveLogFilters', () => {
  it('срок по умолчанию считается отбором: за его пределами записи есть', () => {
    expect(hasActiveLogFilters(DEFAULT_LOG_FILTERS)).toBe(true)
  })

  it('«всё время» без прочих условий отбором не является', () => {
    expect(hasActiveLogFilters({ ...DEFAULT_LOG_FILTERS, period: 'all' })).toBe(false)
  })
})

describe('periodStart', () => {
  const now = new Date('2026-08-16T12:00:00Z')

  it('«всё время» не ограничивает выборку', () => {
    expect(periodStart('all', now)).toBeNull()
  })

  it('срок отсчитывается от текущего момента', () => {
    expect(periodStart('week', now)?.toISOString()).toBe('2026-08-09T12:00:00.000Z')
  })
})

/** Превращает `?a=1&b=2` обратно в набор параметров */
function paramsOf(query: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(query.replace(/^\?/, '')))
}
