import { describe, expect, it } from 'vitest'

import { LEGAL_DOCUMENTS } from './documents'
import {
  fillPlaceholders,
  findPlaceholders,
  PLACEHOLDER_KEYS,
  UNFILLED_MARK,
  unfilledPlaceholders,
} from './placeholders'

import type { PlaceholderValues } from './placeholders'

/** Полный набор значений: у каждого ключа своё узнаваемое значение */
function completeValues(): PlaceholderValues {
  return Object.fromEntries(
    PLACEHOLDER_KEYS.map((key) => [key, `значение-${key}`]),
  ) as PlaceholderValues
}

function emptyValues(): PlaceholderValues {
  return Object.fromEntries(PLACEHOLDER_KEYS.map((key) => [key, ''])) as PlaceholderValues
}

describe('findPlaceholders', () => {
  it('находит все места подстановки без повторов', () => {
    expect(
      findPlaceholders('{{OPERATOR_EMAIL}} и снова {{OPERATOR_EMAIL}}, а также {{INN}}'),
    ).toEqual(['INN', 'OPERATOR_EMAIL'])
  })

  it('не путает места подстановки с обычными фигурными скобками', () => {
    expect(findPlaceholders('текст { не место } и {{OPERATOR_INN}}')).toEqual(['OPERATOR_INN'])
  })
})

describe('fillPlaceholders', () => {
  it('подставляет значения', () => {
    const text = fillPlaceholders('ИНН {{OPERATOR_INN}}', completeValues())
    expect(text).toBe('ИНН значение-OPERATOR_INN')
  })

  it('вместо пустого значения ставит понятную отметку, а не пустоту', () => {
    expect(fillPlaceholders('ИНН {{OPERATOR_INN}}', emptyValues())).toBe(`ИНН ${UNFILLED_MARK}`)
  })

  it('оставляет неизвестное место как есть, чтобы его было видно при вычитке', () => {
    expect(fillPlaceholders('вот {{НЕИЗВЕСТНО}}', completeValues())).toBe('вот {{НЕИЗВЕСТНО}}')
  })
})

describe('unfilledPlaceholders', () => {
  it('перечисляет незаполненное', () => {
    const values = { ...completeValues(), OPERATOR_INN: '', OPERATOR_EMAIL: '   ' }
    expect(unfilledPlaceholders(values)).toEqual(['OPERATOR_INN', 'OPERATOR_EMAIL'])
  })

  it('на полном наборе пусто', () => {
    expect(unfilledPlaceholders(completeValues())).toEqual([])
  })
})

/**
 * Главная проверка этого файла.
 *
 * Опечатка в имени места — `{{EMIAL}}` вместо `{{OPERATOR_EMAIL}}` — никак
 * иначе не обнаруживается: страница собирается, ошибок нет, и в договоре
 * посреди предложения стоит `{{EMIAL}}`. Заметить это можно только глазами
 * при вычитке всего текста, а вычитывают его один раз.
 */
describe('места подстановки в документах', () => {
  for (const document of Object.values(LEGAL_DOCUMENTS)) {
    it(`«${document.title}»: каждое место имеет значение`, () => {
      const unknown = findPlaceholders(document.body).filter(
        (key) => !(PLACEHOLDER_KEYS as readonly string[]).includes(key),
      )

      expect(unknown).toEqual([])
    })

    it(`«${document.title}»: после подстановки не остаётся мест`, () => {
      const filled = fillPlaceholders(document.body, completeValues())
      expect(findPlaceholders(filled)).toEqual([])
    })
  }
})
