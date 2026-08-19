import { describe, expect, it } from 'vitest'

import { formatTimecode, parseTimecode } from './timecode'

describe('parseTimecode', () => {
  it('понимает минуты и секунды', () => {
    expect(parseTimecode('2:14')).toBe(134)
  })

  it('понимает часы для длинных эфиров', () => {
    expect(parseTimecode('1:02:30')).toBe(3750)
  })

  it('понимает просто секунды', () => {
    // Куратор мог скопировать значение из другой системы
    expect(parseTimecode('134')).toBe(134)
  })

  it('пустое поле означает «не указано», а не ноль', () => {
    expect(parseTimecode('')).toBeNull()
    expect(parseTimecode('   ')).toBeNull()
  })

  it('на мусоре не выдумывает число', () => {
    expect(parseTimecode('около двух минут')).toBeNull()
    expect(parseTimecode('2:чуть')).toBeNull()
  })

  it('терпит пробелы по краям', () => {
    expect(parseTimecode('  2:14 ')).toBe(134)
  })
})

describe('formatTimecode', () => {
  it('показывает минуты и секунды с ведущим нулём', () => {
    expect(formatTimecode(134)).toBe('2:14')
    expect(formatTimecode(125)).toBe('2:05')
  })

  it('добавляет часы, когда они есть', () => {
    expect(formatTimecode(3750)).toBe('1:02:30')
  })

  it('нулевую секунду показывает, а отсутствие — нет', () => {
    expect(formatTimecode(0)).toBe('0:00')
    expect(formatTimecode(null)).toBe('')
  })
})

describe('formatTimecode: крайние значения', () => {
  it('ноль — это начало записи, а не «не указано»', () => {
    expect(formatTimecode(0)).toBe('0:00')
  })

  it('отрицательное не ломает подпись', () => {
    // До оглавления такое доехать не должно, но если доехало —
    // «-1:-10» в списке выглядит как поломка платформы
    expect(formatTimecode(-10)).toBe('0:00')
  })

  it('дробные секунды округляет', () => {
    // Плеер отдаёт позицию дробным числом
    expect(formatTimecode(455.4)).toBe('7:35')
  })
})

describe('туда и обратно', () => {
  it('не теряет значение при двойном превращении', () => {
    for (const seconds of [0, 7, 59, 60, 134, 3599, 3750, 7200]) {
      expect(parseTimecode(formatTimecode(seconds))).toBe(seconds)
    }
  })
})
