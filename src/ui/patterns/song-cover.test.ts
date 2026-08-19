import { describe, expect, it } from 'vitest'

import { coverColors, COVER_PALETTE, titleSizeClass } from './song-cover'

/**
 * Тесты типографской обложки.
 *
 * Проверяется одно свойство, но важное: цвет обязан быть **устойчивым**.
 * Меняясь при каждой отрисовке, он превратил бы каталог в мигающую
 * мозаику, и человек перестал бы узнавать карточки, которые уже видел.
 */

describe('coverColors', () => {
  it('одна и та же песня всегда одного цвета', () => {
    const first = coverColors('metallica-nothing-else-matters')
    const second = coverColors('metallica-nothing-else-matters')

    expect(first).toBe(second)
  })

  it('разные песни получают разные цвета', () => {
    const seeds = [
      'metallica-nothing-else-matters',
      'kino-pachka-sigaret',
      'the-beatles-blackbird',
      'eagles-hotel-california',
      'kino-kukushka',
    ]

    const used = new Set(seeds.map((seed) => coverColors(seed).background))

    // Совпадения возможны — палитра конечна. Но пять песен одного цвета
    // означали бы, что цвет вообще не зависит от семени
    expect(used.size).toBeGreaterThan(1)
  })

  it('всегда возвращает цвет из палитры', () => {
    for (const seed of ['', 'a', 'очень длинное название песни на кириллице']) {
      expect(COVER_PALETTE).toContain(coverColors(seed))
    }
  })

  it('не ломается на пустой строке', () => {
    expect(coverColors('').background).toBeTruthy()
  })
})

describe('titleSizeClass', () => {
  it('короткое название пишется крупно', () => {
    expect(titleSizeClass('Перемен')).toContain('text-2xl')
  })

  it('длинное — мельче, чтобы поместиться', () => {
    const short = titleSizeClass('Перемен')
    const long = titleSizeClass('Всё идёт по плану, и это довольно длинное название')

    expect(short).not.toBe(long)
  })

  it('для любой длины возвращается непустой размер', () => {
    for (const length of [1, 10, 20, 30, 50, 200]) {
      expect(titleSizeClass('я'.repeat(length))).toMatch(/text-/)
    }
  })
})
