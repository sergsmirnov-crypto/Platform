import { describe, expect, it } from 'vitest'

import {
  countNotesByEntity,
  groupNotes,
  isNoteTooLong,
  isValidTimecode,
  normalizeNoteBody,
  sortNotes,
} from './notes-rules'

import type { Note } from './types'

function note(partial: Partial<Note> & { id: string }): Note {
  return {
    entityType: 'arrangement',
    entityId: 'a',
    body: 'текст',
    timecodeSec: null,
    createdAt: new Date(2026, 0, 1),
    updatedAt: new Date(2026, 0, 1),
    ...partial,
  }
}

describe('sortNotes', () => {
  it('расставляет по времени в ролике, а не по дате создания', () => {
    const notes = [
      note({ id: 'поздняя-часть', timecodeSec: 300, createdAt: new Date(2026, 0, 1) }),
      note({ id: 'вступление', timecodeSec: 12, createdAt: new Date(2026, 0, 5) }),
    ]

    expect(sortNotes(notes).map((item) => item.id)).toEqual(['вступление', 'поздняя-часть'])
  })

  it('заметки без времени уходят в конец', () => {
    const notes = [
      note({ id: 'без-времени', timecodeSec: null }),
      note({ id: 'с-временем', timecodeSec: 100 }),
    ]

    expect(sortNotes(notes).map((item) => item.id)).toEqual(['с-временем', 'без-времени'])
  })

  it('среди заметок без времени порядок по дате создания', () => {
    const notes = [
      note({ id: 'вторая', createdAt: new Date(2026, 0, 5) }),
      note({ id: 'первая', createdAt: new Date(2026, 0, 1) }),
    ]

    expect(sortNotes(notes).map((item) => item.id)).toEqual(['первая', 'вторая'])
  })

  it('нулевая секунда — это время, а не его отсутствие', () => {
    const notes = [note({ id: 'без-времени' }), note({ id: 'самое-начало', timecodeSec: 0 })]

    expect(sortNotes(notes).map((item) => item.id)).toEqual(['самое-начало', 'без-времени'])
  })

  it('не меняет исходный список', () => {
    const source = [note({ id: 'b', timecodeSec: 20 }), note({ id: 'a', timecodeSec: 10 })]
    sortNotes(source)

    expect(source.map((item) => item.id)).toEqual(['b', 'a'])
  })
})

describe('normalizeNoteBody', () => {
  it('снимает пробелы по краям', () => {
    expect(normalizeNoteBody('  вот здесь застреваю  ')).toBe('вот здесь застреваю')
  })

  it('заметка из одних пробелов — это отсутствие заметки', () => {
    expect(normalizeNoteBody('   ')).toBeNull()
    expect(normalizeNoteBody('')).toBeNull()
    expect(normalizeNoteBody('\n\t')).toBeNull()
  })

  it('переносы строк внутри сохраняются', () => {
    expect(normalizeNoteBody('первая\nвторая')).toBe('первая\nвторая')
  })
})

describe('isNoteTooLong', () => {
  it('предел проверяется по длине текста', () => {
    expect(isNoteTooLong('а'.repeat(10), 10)).toBe(false)
    expect(isNoteTooLong('а'.repeat(11), 10)).toBe(true)
  })
})

describe('isValidTimecode', () => {
  it('отсутствие времени допустимо', () => {
    expect(isValidTimecode(null)).toBe(true)
  })

  it('ноль и обычные значения допустимы', () => {
    expect(isValidTimecode(0)).toBe(true)
    expect(isValidTimecode(3600)).toBe(true)
  })

  it('отрицательное и запредельное отбрасывается', () => {
    expect(isValidTimecode(-1)).toBe(false)
    expect(isValidTimecode(24 * 60 * 60 + 1)).toBe(false)
  })

  it('нечисло отбрасывается: значение приходит из браузера', () => {
    expect(isValidTimecode(Number.NaN)).toBe(false)
    expect(isValidTimecode(Number.POSITIVE_INFINITY)).toBe(false)
  })
})

describe('groupNotes', () => {
  const notes = [
    note({ id: '1', entityId: 'песня', timecodeSec: 100 }),
    note({ id: '2', entityType: 'lesson', entityId: 'урок' }),
    note({ id: '3', entityId: 'песня', timecodeSec: 20 }),
  ]

  it('собирает заметки одной записи вместе', () => {
    const groups = groupNotes(notes)

    expect(groups).toHaveLength(2)
    expect(groups[0]?.notes.map((item) => item.id)).toEqual(['3', '1'])
  })

  it('порядок групп задаёт первая встреченная заметка', () => {
    expect(groupNotes(notes).map((group) => group.ref.entityId)).toEqual(['песня', 'урок'])
  })

  it('одинаковые идентификаторы разных видов не смешиваются', () => {
    const groups = groupNotes([
      note({ id: '1', entityType: 'lesson', entityId: 'x' }),
      note({ id: '2', entityType: 'stream', entityId: 'x' }),
    ])

    expect(groups).toHaveLength(2)
  })
})

describe('countNotesByEntity', () => {
  it('считает по видам и возвращает нули по всем', () => {
    expect(countNotesByEntity([])).toEqual({ arrangement: 0, lesson: 0, stream: 0 })
    expect(
      countNotesByEntity([note({ id: '1' }), note({ id: '2', entityType: 'stream' })]),
    ).toEqual({ arrangement: 1, lesson: 0, stream: 1 })
  })
})
