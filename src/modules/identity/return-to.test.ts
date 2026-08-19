import { describe, expect, it } from 'vitest'

import { safeReturnTo } from './return-to'

/**
 * Открытое перенаправление — уязвимость, которую легко не заметить:
 * вход проходит успешно, и человек оказывается на чужом сайте,
 * будучи уверен, что он на платформе.
 */
describe('safeReturnTo', () => {
  it('пропускает внутренний адрес', () => {
    expect(safeReturnTo('/app/learn/songs')).toBe('/app/learn/songs')
  })

  it('сохраняет параметры адреса', () => {
    expect(safeReturnTo('/app/learn/songs?level=beginner')).toBe('/app/learn/songs?level=beginner')
  })

  it('отклоняет полный адрес чужого сайта', () => {
    expect(safeReturnTo('https://pohozhij-sajt.ru')).toBe('/app')
  })

  it('отклоняет адрес без схемы, начинающийся с двух слешей', () => {
    // Браузер трактует это как переход наружу, хотя выглядит как внутренний путь
    expect(safeReturnTo('//pohozhij-sajt.ru')).toBe('/app')
  })

  it('отклоняет обход через обратный слеш', () => {
    expect(safeReturnTo('/\\pohozhij-sajt.ru')).toBe('/app')
  })

  it('отклоняет относительный путь', () => {
    expect(safeReturnTo('app/learn')).toBe('/app')
  })

  it('возвращает главную, если параметра нет', () => {
    expect(safeReturnTo(null)).toBe('/app')
    expect(safeReturnTo(undefined)).toBe('/app')
    expect(safeReturnTo('')).toBe('/app')
  })
})
