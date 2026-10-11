import { describe, expect, it } from 'vitest'

import { greetingFor } from './greeting'

describe('greetingFor', () => {
  it('утро начинается в пять', () => {
    expect(greetingFor(5)).toBe('Доброе утро')
    expect(greetingFor(11)).toBe('Доброе утро')
  })

  it('день с двенадцати до шести', () => {
    expect(greetingFor(12)).toBe('Добрый день')
    expect(greetingFor(17)).toBe('Добрый день')
  })

  it('вечер с шести до одиннадцати', () => {
    expect(greetingFor(18)).toBe('Добрый вечер')
    expect(greetingFor(22)).toBe('Добрый вечер')
  })

  it('ночью не здороваются днём', () => {
    expect(greetingFor(23)).toBe('Доброй ночи')
    expect(greetingFor(0)).toBe('Доброй ночи')
    expect(greetingFor(4)).toBe('Доброй ночи')
  })

  it('на любом часе суток есть приветствие', () => {
    for (let hour = 0; hour < 24; hour += 1) {
      expect(greetingFor(hour), `час ${hour}`).toBeTruthy()
    }
  })
})
