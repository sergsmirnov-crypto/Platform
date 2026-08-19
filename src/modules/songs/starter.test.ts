import { describe, expect, it } from 'vitest'

import { starterAttempts } from './starter'

/**
 * Порядок попыток подобрать первый разбор.
 *
 * Проверяется именно порядок: перепутанный незаметен, пока в клубе есть
 * разборы всех уровней и всех жанров. Обнаружится он на пустой платформе
 * или у человека с редким вкусом — то есть в самый неподходящий момент.
 */
describe('starterAttempts', () => {
  it('при полных ответах сначала пробует уровень вместе с жанрами', () => {
    const attempts = starterAttempts({ level: 'intermediate', genres: ['Блюз'] })

    expect(attempts[0]).toEqual({
      level: 'intermediate',
      genres: ['Блюз'],
      reason: 'уровень и жанры',
    })
  })

  it('последняя попытка всегда самая грубая: любой свежий разбор', () => {
    const attempts = starterAttempts({ level: 'advanced', genres: ['Джаз'] })

    expect(attempts[attempts.length - 1]).toEqual({
      level: null,
      genres: [],
      reason: 'любой свежий разбор',
    })
  })

  it('попытки идут от точной к грубой', () => {
    const reasons = starterAttempts({ level: 'intermediate', genres: ['Рок'] }).map(
      (attempt) => attempt.reason,
    )

    expect(reasons).toEqual([
      'уровень и жанры',
      'уровень',
      'соседний уровень',
      'жанры',
      'любой свежий разбор',
    ])
  })

  it('сосед ищется в сторону простоты: уверенному предлагается начинающий', () => {
    const attempts = starterAttempts({ level: 'intermediate', genres: [] })
    const neighbour = attempts.find((attempt) => attempt.reason === 'соседний уровень')

    expect(neighbour?.level).toBe('beginner')
  })

  it('продвинутому сосед — уверенный, а не начинающий', () => {
    const attempts = starterAttempts({ level: 'advanced', genres: [] })
    const neighbour = attempts.find((attempt) => attempt.reason === 'соседний уровень')

    expect(neighbour?.level).toBe('intermediate')
  })

  it('начинающему соседа не предлагается: продвинутый разбор первым отбивает желание', () => {
    const attempts = starterAttempts({ level: 'beginner', genres: [] })

    expect(attempts.some((attempt) => attempt.reason === 'соседний уровень')).toBe(false)
  })

  it('человек, пропустивший все вопросы, получает одну грубую попытку', () => {
    expect(starterAttempts({ level: null, genres: [] })).toEqual([
      { level: null, genres: [], reason: 'любой свежий разбор' },
    ])
  })

  it('ответивший только про жанры не получает попыток по уровню', () => {
    const reasons = starterAttempts({ level: null, genres: ['Фолк'] }).map(
      (attempt) => attempt.reason,
    )

    expect(reasons).toEqual(['жанры', 'любой свежий разбор'])
  })
})
