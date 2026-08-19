import { describe, expect, it } from 'vitest'

import { plural } from './plural'

describe('plural', () => {
  const форма = (count: number) => plural(count, 'день', 'дня', 'дней')

  it('выбирает форму по последней цифре', () => {
    expect(форма(1)).toBe('день')
    expect(форма(2)).toBe('дня')
    expect(форма(5)).toBe('дней')
    expect(форма(21)).toBe('день')
    expect(форма(103)).toBe('дня')
  })

  it('знает про исключение одиннадцать–четырнадцать', () => {
    // Главная ловушка правила: «через 11 дней», а не «через 11 день»
    expect(форма(11)).toBe('дней')
    expect(форма(12)).toBe('дней')
    expect(форма(14)).toBe('дней')
    expect(форма(111)).toBe('дней')
  })

  it('считает ноль множественным', () => {
    expect(форма(0)).toBe('дней')
  })
})
