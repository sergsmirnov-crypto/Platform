import { describe, expect, it } from 'vitest'

import { arrangementInputSchema, sectionInputSchema, songInputSchema } from './editor-schema'

const VALID_SONG = {
  title: 'Nothing Else Matters',
  artist: 'Metallica',
  album: null,
  year: 1991,
  description: null,
  tuning: 'E standard',
  capo: null,
  tempoBpm: 72,
  musicKey: 'Em',
  tagIds: [],
}

describe('songInputSchema', () => {
  it('принимает заполненную песню', () => {
    expect(songInputSchema.safeParse(VALID_SONG).success).toBe(true)
  })

  it('требует название и исполнителя', () => {
    const result = songInputSchema.safeParse({ ...VALID_SONG, title: '   ' })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Укажите название песни')
  })

  it('обрезает пробелы по краям', () => {
    const result = songInputSchema.parse({ ...VALID_SONG, title: '  Кукушка  ' })

    expect(result.title).toBe('Кукушка')
  })

  it('пустое необязательное поле превращает в «не заполнено»', () => {
    // Иначе в базе окажется пустая строка, и фильтр «есть строй»
    // начнёт считать её заполненным значением
    const result = songInputSchema.parse({ ...VALID_SONG, tuning: '   ', album: '' })

    expect(result.tuning).toBeNull()
    expect(result.album).toBeNull()
  })

  it('не пропускает год из будущего', () => {
    const result = songInputSchema.safeParse({ ...VALID_SONG, year: 2400 })

    expect(result.success).toBe(false)
  })

  it('не пропускает каподастр выше двенадцатого лада', () => {
    expect(songInputSchema.safeParse({ ...VALID_SONG, capo: 15 }).success).toBe(false)
  })

  it('не пропускает невозможный темп', () => {
    expect(songInputSchema.safeParse({ ...VALID_SONG, tempoBpm: 900 }).success).toBe(false)
  })
})

describe('arrangementInputSchema', () => {
  it('принимает вариант с уровнем', () => {
    const result = arrangementInputSchema.safeParse({
      level: 'intermediate',
      title: null,
      summary: null,
      estimatedMinutes: 90,
    })

    expect(result.success).toBe(true)
  })

  it('не принимает выдуманный уровень', () => {
    const result = arrangementInputSchema.safeParse({
      level: 'god_mode',
      title: null,
      summary: null,
      estimatedMinutes: null,
    })

    expect(result.success).toBe(false)
  })
})

describe('sectionInputSchema', () => {
  const base = { title: 'Соло', description: null, videoStartSec: 100, videoEndSec: 200 }

  it('принимает часть с таймкодами', () => {
    expect(sectionInputSchema.safeParse(base).success).toBe(true)
  })

  it('ловит конец раньше начала', () => {
    const result = sectionInputSchema.safeParse({ ...base, videoEndSec: 50 })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Конец части раньше её начала')
  })

  it('разрешает часть без таймкодов: видео может быть ещё не загружено', () => {
    const result = sectionInputSchema.safeParse({
      ...base,
      videoStartSec: null,
      videoEndSec: null,
    })

    expect(result.success).toBe(true)
  })

  it('требует название', () => {
    expect(sectionInputSchema.safeParse({ ...base, title: '' }).success).toBe(false)
  })
})
