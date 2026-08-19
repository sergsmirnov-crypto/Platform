import { describe, expect, it } from 'vitest'

import { GENRE_NAMES, GENRE_TAGS, MOOD_TAGS, TAG_SEEDS, TECHNIQUE_TAGS } from './catalog'

/**
 * Тесты справочника меток.
 *
 * Проверяется то, от чего зависит работоспособность фильтров: адресные
 * имена меток должны быть неповторимыми, иначе две разные метки укажут
 * на один адрес и фильтр начнёт молча подменять одну другой.
 */

describe('жанры', () => {
  it('справочник собран из общего списка жанров платформы', () => {
    expect(GENRE_TAGS.map((tag) => tag.name)).toEqual([...GENRE_NAMES])
  })
})

describe('справочник меток', () => {
  it('адресные имена не повторяются', () => {
    const slugs = TAG_SEEDS.map((tag) => tag.slug)

    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('у каждой метки есть непустое адресное имя', () => {
    for (const tag of TAG_SEEDS) {
      expect(tag.slug).not.toBe('')
      expect(tag.slug).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('вид входит в адресное имя: «Фингерстайл» бывает и жанром, и техникой', () => {
    const asGenre = GENRE_TAGS.find((tag) => tag.name === 'Фингерстайл')
    const asTechnique = TECHNIQUE_TAGS.find((tag) => tag.name === 'Фингерстайл')

    expect(asGenre).toBeDefined()
    expect(asTechnique).toBeDefined()
    expect(asGenre?.slug).not.toBe(asTechnique?.slug)
    expect(asGenre?.slug.startsWith('genre-')).toBe(true)
    expect(asTechnique?.slug.startsWith('technique-')).toBe(true)
  })

  it('виды не перемешаны', () => {
    expect(GENRE_TAGS.every((tag) => tag.kind === 'genre')).toBe(true)
    expect(TECHNIQUE_TAGS.every((tag) => tag.kind === 'technique')).toBe(true)
    expect(MOOD_TAGS.every((tag) => tag.kind === 'mood')).toBe(true)
  })

  it('порядок задан внутри каждого вида, а не сквозной', () => {
    expect(GENRE_TAGS[0]?.orderIndex).toBe(0)
    expect(TECHNIQUE_TAGS[0]?.orderIndex).toBe(0)
  })
})
