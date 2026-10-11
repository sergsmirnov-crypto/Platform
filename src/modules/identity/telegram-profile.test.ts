import { describe, expect, it } from 'vitest'

import {
  DEFAULT_DISPLAY_NAME,
  displayNameFromTelegram,
  providerDataFromTelegram,
} from './telegram-profile'

describe('displayNameFromTelegram', () => {
  it('собирает имя и фамилию', () => {
    expect(displayNameFromTelegram({ first_name: 'Иван', last_name: 'Петров' })).toBe('Иван Петров')
  })

  it('без имени берёт имя пользователя', () => {
    expect(displayNameFromTelegram({ first_name: ' ', username: 'ivan' })).toBe('ivan')
  })

  it('без имени и имени пользователя — заглушка', () => {
    expect(displayNameFromTelegram({ first_name: '' })).toBe(DEFAULT_DISPLAY_NAME)
  })
})

describe('providerDataFromTelegram', () => {
  it('сохраняет имя пользователя: по нему водяной знак указывает на источник утечки', () => {
    expect(providerDataFromTelegram({ first_name: 'Иван', username: 'ivan' })).toMatchObject({
      firstName: 'Иван',
      username: 'ivan',
    })
  })

  it('не записывает пустые поля', () => {
    const data = providerDataFromTelegram({ first_name: 'Иван' })

    expect(data).not.toHaveProperty('lastName')
    expect(data).not.toHaveProperty('username')
  })
})
