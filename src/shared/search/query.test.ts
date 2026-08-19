import { describe, expect, it } from 'vitest'

import {
  fixKeyboardLayout,
  hasSearch,
  parseSearchQuery,
  similarityInputs,
  splitTerms,
  transliterate,
} from './query'

/**
 * Тесты разбора поискового запроса.
 *
 * Проверяется не «строка делится на слова», а три настоящих промаха,
 * ради которых всё это написано: забытая раскладка, кириллица вместо
 * латиницы и попытка передать в базу собственное выражение.
 */

describe('fixKeyboardLayout', () => {
  it('латиница, набранная в русской раскладке', () => {
    expect(fixKeyboardLayout('Тщерштп')).toBe('nothing')
  })

  it('кириллица, набранная в английской раскладке', () => {
    expect(fixKeyboardLayout('Vjnjhjkkth')).toBe('мотороллер')
  })

  it('цифры и пробелы не трогает', () => {
    expect(fixKeyboardLayout('yjxm 2')).toBe('ночь 2')
  })

  it('символы вне таблицы оставляет как есть', () => {
    expect(fixKeyboardLayout('rjyxbnm — 1')).toBe('кончить — 1')
  })
})

describe('transliterate', () => {
  it('пишет русское название латиницей', () => {
    expect(transliterate('металлика')).toBe('metallika')
  })

  it('справляется с шипящими', () => {
    expect(transliterate('щука')).toBe('schuka')
  })

  it('мягкий и твёрдый знаки пропадают', () => {
    expect(transliterate('день')).toBe('den')
  })

  it('латиницу не трогает', () => {
    expect(transliterate('nirvana')).toBe('nirvana')
  })

  it('второй вариант пишет «к» латинской c', () => {
    // Ради ровно одного случая, но самого частого: «металлика»
    // с буквой k не совпадает с «Metallica» вообще
    expect(transliterate('металлика', true)).toBe('metallica')
  })
})

describe('splitTerms', () => {
  it('делит по всему, что не буква и не цифра', () => {
    expect(splitTerms('Nothing Else Matters')).toEqual(['nothing', 'else', 'matters'])
  })

  it('выбрасывает слова короче двух букв', () => {
    expect(splitTerms('a nothing')).toEqual(['nothing'])
  })

  it('выбрасывает знаки, значимые для полнотекстового поиска', () => {
    // Иначе такой запрос сломал бы выражение и вернул ошибку базы
    expect(splitTerms('nothing & !else | (matters)')).toEqual(['nothing', 'else', 'matters'])
  })

  it('не позволяет раздуть выражение сотней слов', () => {
    const long = Array.from({ length: 40 }, (_, index) => `слово${index}`).join(' ')

    expect(splitTerms(long)).toHaveLength(8)
  })

  it('пустой запрос даёт пустой список', () => {
    expect(splitTerms('   ')).toEqual([])
  })
})

describe('parseSearchQuery', () => {
  it('пустой запрос искать нечего', () => {
    const parsed = parseSearchQuery('  ')

    expect(hasSearch(parsed)).toBe(false)
    expect(parsed.tsquery).toBe('')
  })

  it('несколько слов соединяются через «и»', () => {
    // Человек, напечатавший два слова, хочет песню, где есть оба
    expect(parseSearchQuery('nothing else').tsquery.startsWith('nothing & else:*')).toBe(true)
  })

  it('последнее слово ищется по началу: человек ещё печатает', () => {
    expect(parseSearchQuery('метал').tsquery.startsWith('метал:*')).toBe(true)
  })

  it('короткой догадке поиск по началу слова запрещён', () => {
    // «ыф» превратилось бы в «sa:*» и совпало с «Sarah» и «Satisfaction»
    const parsed = parseSearchQuery('ыф')

    expect(parsed.tsquery).toContain('sa')
    expect(parsed.tsquery).not.toContain('sa:*')
  })

  it('длинной догадке — разрешён', () => {
    // Иначе «метал» не находит «Metallica»: целым словом «metal»
    // с ней не совпадает. Проверено на живой базе
    expect(parseSearchQuery('метал').tsquery).toContain('metal:*')
  })

  it('слова не в том порядке всё равно находятся', () => {
    // Порядок в выражении «и» роли не играет — этим оно и лучше `ILIKE`
    const direct = parseSearchQuery('nothing matters')
    const reversed = parseSearchQuery('matters nothing')

    expect(direct.terms.sort()).toEqual(reversed.terms.sort())
  })

  it('добавляет вариант с исправленной раскладкой', () => {
    const parsed = parseSearchQuery('Тщерштп')

    expect(parsed.variants).toContain('nothing')
    expect(parsed.tsquery).toContain(' | ')
  })

  it('добавляет вариант латиницей для русского запроса', () => {
    expect(parseSearchQuery('металлика').variants).toContain('metallika')
  })

  it('не исправляет раскладку у смешанного запроса', () => {
    // «Metallica ничего» напечатано осознанно: любое исправление
    // испортило бы половину запроса
    const parsed = parseSearchQuery('Metallica ничего')

    // Повтор отброшен: «ничего» не содержит «к», и оба варианта
    // транслитерации дают одно и то же
    expect(parsed.variants).toEqual(['metallica ничего', 'metallica nichego'])
  })

  it('не плодит одинаковые варианты', () => {
    const parsed = parseSearchQuery('nirvana')

    expect(new Set(parsed.variants).size).toBe(parsed.variants.length)
  })

  it('обрезает слишком длинный запрос', () => {
    const parsed = parseSearchQuery('я'.repeat(500))

    expect(parsed.raw.length).toBeLessThanOrEqual(100)
  })

  it('запрос из одних знаков препинания искать нечего', () => {
    expect(hasSearch(parseSearchQuery('!!! ??? &&&'))).toBe(false)
  })
})

describe('similarityInputs', () => {
  it('отдаёт все варианты запроса', () => {
    // Триграммы не переходят между алфавитами: без латинского варианта
    // подсказка для русского запроса не нашла бы зарубежную группу.
    // Вариант с исправленной раскладкой тоже нужен — именно он спасает
    // запрос, набранный не в том языке
    expect(similarityInputs(parseSearchQuery('металика'))).toEqual([
      'металика',
      'vtnfkbrf',
      'metalika',
      'metalica',
    ])
  })

  it('у запроса не в той раскладке похожесть ищется по исправленному', () => {
    expect(similarityInputs(parseSearchQuery('Тщерштп'))).toContain('nothing')
  })
})
