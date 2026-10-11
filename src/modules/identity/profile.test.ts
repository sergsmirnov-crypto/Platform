import { describe, expect, it } from 'vitest'

import {
  MAX_FAVORITE_ARTISTS,
  normalizeArtists,
  profileInputSchema,
  yearsPlayingLabel,
} from './profile'

const VALID = {
  displayName: 'Артём',
  city: null,
  bio: null,
  playingSince: null,
  skillLevel: null,
  favoriteArtists: [],
  favoriteGenres: [],
  socials: {},
}

describe('profileInputSchema', () => {
  it('принимает заполненный профиль', () => {
    const result = profileInputSchema.safeParse({
      ...VALID,
      city: 'Казань',
      playingSince: 2015,
      skillLevel: 'intermediate',
      favoriteArtists: ['Metallica'],
      favoriteGenres: ['Рок'],
      socials: { vk: 'https://vk.com/id1' },
    })

    expect(result.success).toBe(true)
  })

  it('требует имя хотя бы из двух букв', () => {
    expect(profileInputSchema.safeParse({ ...VALID, displayName: 'А' }).success).toBe(false)
  })

  it('обрезает пробелы вокруг имени', () => {
    const result = profileInputSchema.parse({ ...VALID, displayName: '  Артём  ' })
    expect(result.displayName).toBe('Артём')
  })

  it('пустая строка означает «не заполнено»', () => {
    const result = profileInputSchema.parse({ ...VALID, city: '   ', bio: '' })
    expect(result.city).toBeNull()
    expect(result.bio).toBeNull()
  })

  it('не принимает год начала игры из будущего', () => {
    const nextYear = new Date().getFullYear() + 1
    expect(profileInputSchema.safeParse({ ...VALID, playingSince: nextYear }).success).toBe(false)
  })

  it('не принимает жанр не из списка', () => {
    expect(profileInputSchema.safeParse({ ...VALID, favoriteGenres: ['Шансон'] }).success).toBe(
      false,
    )
  })

  it('ссылка обязана быть https', () => {
    expect(profileInputSchema.safeParse({ ...VALID, socials: { vk: 'vk.com/id1' } }).success).toBe(
      false,
    )
  })

  it('пустая ссылка допустима', () => {
    const result = profileInputSchema.parse({ ...VALID, socials: { vk: '' } })
    expect(result.socials.vk).toBeNull()
  })
})

describe('normalizeArtists', () => {
  it('разбирает перечисление через запятую', () => {
    expect(normalizeArtists(['Metallica, Nirvana'])).toEqual(['Metallica', 'Nirvana'])
  })

  it('убирает лишние пробелы', () => {
    expect(normalizeArtists(['  Pink   Floyd  '])).toEqual(['Pink Floyd'])
  })

  it('не добавляет повторы, не различая регистр', () => {
    expect(normalizeArtists(['Metallica', 'metallica'])).toEqual(['Metallica'])
  })

  it('отбрасывает пустые значения', () => {
    expect(normalizeArtists(['Кино,, ,Ария'])).toEqual(['Кино', 'Ария'])
  })

  it('не пропускает больше допустимого', () => {
    const many = Array.from({ length: 30 }, (_, index) => `Группа ${index}`)
    expect(normalizeArtists(many)).toHaveLength(MAX_FAVORITE_ARTISTS)
  })
})

describe('yearsPlayingLabel', () => {
  const now = new Date('2026-06-01T00:00:00Z')

  it('без года начала подписи нет', () => {
    expect(yearsPlayingLabel(null, now)).toBeNull()
  })

  it('меньше года — отдельная формулировка', () => {
    expect(yearsPlayingLabel(2026, now)).toBe('Играю меньше года')
  })

  it('склоняет правильно', () => {
    expect(yearsPlayingLabel(2025, now)).toBe('Играю 1 год')
    expect(yearsPlayingLabel(2023, now)).toBe('Играю 3 года')
    expect(yearsPlayingLabel(2019, now)).toBe('Играю 7 лет')
    expect(yearsPlayingLabel(2005, now)).toBe('Играю 21 год')
    expect(yearsPlayingLabel(2003, now)).toBe('Играю 23 года')
  })

  it('одиннадцать и двенадцать — исключение из правила', () => {
    expect(yearsPlayingLabel(2015, now)).toBe('Играю 11 лет')
    expect(yearsPlayingLabel(2014, now)).toBe('Играю 12 лет')
  })
})
