import { describe, expect, it } from 'vitest'

import { buildChapters, PLAYBACK_TOKEN_TTL_SECONDS, watermarkText } from './playback'

describe('watermarkText', () => {
  it('пишет имя и псевдоним', () => {
    expect(watermarkText({ displayName: 'Артём Смирнов', username: 'artem' })).toBe(
      'Артём Смирнов · @artem',
    )
  })

  it('не удваивает собачку', () => {
    expect(watermarkText({ displayName: 'Артём', username: '@artem' })).toBe('Артём · @artem')
  })

  it('без псевдонима обходится именем', () => {
    expect(watermarkText({ displayName: 'Артём Смирнов', username: null })).toBe('Артём Смирнов')
  })

  it('никогда не остаётся пустым', () => {
    // Пустой знак — это запись без подписи, то есть отсутствие защиты
    expect(watermarkText({ displayName: '   ', username: null })).toBe('Участник клуба')
  })
})

describe('buildChapters', () => {
  it('собирает точки из частей разбора', () => {
    const chapters = buildChapters([
      { title: 'Вступление', startSec: 0 },
      { title: 'Куплет', startSec: 134 },
    ])

    expect(chapters).toEqual([
      { position: 0, title: 'Вступление' },
      { position: 134, title: 'Куплет' },
    ])
  })

  it('упорядочивает точки по времени', () => {
    const chapters = buildChapters([
      { title: 'Соло', startSec: 300 },
      { title: 'Вступление', startSec: 0 },
    ])

    expect(chapters.map((chapter) => chapter.title)).toEqual(['Вступление', 'Соло'])
  })

  it('добавляет начало, если первая часть начинается не с нуля', () => {
    const chapters = buildChapters([{ title: 'Куплет', startSec: 60 }])

    expect(chapters[0]).toEqual({ position: 0, title: 'Начало' })
  })

  it('пропускает части со своим видео: в общем ролике их нет', () => {
    const chapters = buildChapters([
      { title: 'Вступление', startSec: 0 },
      { title: 'Отдельный ролик', startSec: null },
    ])

    expect(chapters).toHaveLength(1)
  })

  it('без размеченных частей оглавления не строит', () => {
    expect(buildChapters([{ title: 'Всё целиком', startSec: null }])).toEqual([])
    expect(buildChapters([])).toEqual([])
  })
})

describe('PLAYBACK_TOKEN_TTL_SECONDS', () => {
  it('переживает полуторачасовой эфир', () => {
    // Ключ, истёкший на середине записи, оборвёт просмотр
    expect(PLAYBACK_TOKEN_TTL_SECONDS).toBeGreaterThan(90 * 60)
  })
})
