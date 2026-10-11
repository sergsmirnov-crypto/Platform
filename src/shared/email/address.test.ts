import { describe, expect, it } from 'vitest'

import { emailSchema, maskEmail, normalizeEmail } from './address'

describe('normalizeEmail', () => {
  it('убирает пробелы и приводит регистр: иначе один ящик даст два аккаунта', () => {
    expect(normalizeEmail('  Ivan.Petrov@Mail.RU ')).toBe('ivan.petrov@mail.ru')
  })
})

describe('emailSchema', () => {
  it('принимает обычный адрес и возвращает его приведённым', () => {
    const result = emailSchema.safeParse(' Guitar@Club.ru')

    expect(result.success).toBe(true)
    expect(result.data).toBe('guitar@club.ru')
  })

  it.each(['', 'ivan', 'ivan@', '@mail.ru', 'ivan @mail.ru'])('отклоняет «%s»', (value) => {
    expect(emailSchema.safeParse(value).success).toBe(false)
  })

  it('отклоняет адрес длиннее допустимого стандартом', () => {
    const long = `${'a'.repeat(250)}@x.ru`

    expect(emailSchema.safeParse(long).success).toBe(false)
  })
})

describe('maskEmail', () => {
  it('оставляет две первые буквы имени и домен', () => {
    expect(maskEmail('ivan@mail.ru')).toBe('iv***@mail.ru')
  })

  it('у короткого имени оставляет одну букву', () => {
    expect(maskEmail('ab@mail.ru')).toBe('a***@mail.ru')
  })

  it('не падает на строке без @', () => {
    expect(maskEmail('broken')).toBe('***')
  })
})
