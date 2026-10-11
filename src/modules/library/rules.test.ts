import { describe, expect, it } from 'vitest'

import {
  countByEntity,
  DEFAULT_FAVORITE_TAB,
  favoriteKey,
  filterByTab,
  isLimitReached,
  parseFavoriteTab,
  sortByRecent,
  toFavoriteKeys,
} from './rules'

import type { FavoriteRow } from './types'

function row(entityType: FavoriteRow['entityType'], entityId: string, day: number): FavoriteRow {
  return { entityType, entityId, createdAt: new Date(2026, 0, day) }
}

const ROWS: FavoriteRow[] = [
  row('song', 'a', 3),
  row('stream', 'b', 2),
  row('song', 'c', 1),
  row('lesson', 'd', 4),
]

describe('parseFavoriteTab', () => {
  it('принимает известные вкладки', () => {
    expect(parseFavoriteTab('song')).toBe('song')
    expect(parseFavoriteTab('stream')).toBe('stream')
    expect(parseFavoriteTab('lesson')).toBe('lesson')
  })

  it('на неизвестное значение отвечает вкладкой по умолчанию, а не ошибкой', () => {
    expect(parseFavoriteTab('songs')).toBe(DEFAULT_FAVORITE_TAB)
    expect(parseFavoriteTab('')).toBe(DEFAULT_FAVORITE_TAB)
    expect(parseFavoriteTab(undefined)).toBe(DEFAULT_FAVORITE_TAB)
  })

  it('из повторённого параметра берёт первое значение', () => {
    expect(parseFavoriteTab(['stream', 'song'])).toBe('stream')
  })
})

describe('favoriteKey и toFavoriteKeys', () => {
  it('различает объекты разных видов с одинаковым идентификатором', () => {
    expect(favoriteKey({ entityType: 'song', entityId: 'x' })).not.toBe(
      favoriteKey({ entityType: 'lesson', entityId: 'x' }),
    )
  })

  it('собирает набор для проверки «отложено ли»', () => {
    const keys = toFavoriteKeys(ROWS)

    expect(keys.has(favoriteKey({ entityType: 'song', entityId: 'a' }))).toBe(true)
    expect(keys.has(favoriteKey({ entityType: 'song', entityId: 'b' }))).toBe(false)
  })
})

describe('filterByTab', () => {
  it('вкладка «Всё» возвращает всё и в том же порядке', () => {
    expect(filterByTab(ROWS, 'all')).toEqual(ROWS)
  })

  it('отбирает нужный вид', () => {
    expect(filterByTab(ROWS, 'song').map((item) => item.entityId)).toEqual(['a', 'c'])
  })

  it('порядок внутри вкладки не меняется', () => {
    const songs = filterByTab(ROWS, 'song')

    expect(songs[0]?.entityId).toBe('a')
    expect(songs[1]?.entityId).toBe('c')
  })

  it('пустая вкладка — это пустой список, а не ошибка', () => {
    expect(filterByTab([], 'stream')).toEqual([])
  })
})

describe('countByEntity', () => {
  it('считает по видам', () => {
    expect(countByEntity(ROWS)).toEqual({ song: 2, stream: 1, lesson: 1 })
  })

  it('на пустом списке возвращает нули по всем видам, а не пустой объект', () => {
    expect(countByEntity([])).toEqual({ song: 0, stream: 0, lesson: 0 })
  })
})

describe('isLimitReached', () => {
  it('предел достигнут при равенстве, а не только при превышении', () => {
    expect(isLimitReached(499, 500)).toBe(false)
    expect(isLimitReached(500, 500)).toBe(true)
    expect(isLimitReached(501, 500)).toBe(true)
  })
})

describe('sortByRecent', () => {
  it('свежее сверху', () => {
    expect(sortByRecent(ROWS).map((item) => item.entityId)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('не меняет исходный список', () => {
    const source = [...ROWS]
    sortByRecent(source)

    expect(source.map((item) => item.entityId)).toEqual(['a', 'b', 'c', 'd'])
  })
})
