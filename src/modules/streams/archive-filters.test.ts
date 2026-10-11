import { describe, expect, it } from 'vitest'

import {
  archiveOffset,
  buildArchiveQuery,
  hasArchiveFilters,
  parseArchiveFilters,
  searchTerms,
} from './archive-filters'

const CURATOR = '3f1a5c72-9d0b-4f2e-8a11-6c7d8e9f0a1b'

describe('parseArchiveFilters', () => {
  it('читает пустой адрес как первую страницу без фильтров', () => {
    expect(parseArchiveFilters({})).toEqual({ query: null, curatorId: null, page: 1 })
  })

  it('читает поиск, куратора и страницу', () => {
    expect(parseArchiveFilters({ q: 'баррэ', curator: CURATOR, page: '3' })).toEqual({
      query: 'баррэ',
      curatorId: CURATOR,
      page: 3,
    })
  })

  it('игнорирует мусор вместо номера страницы, а не отвергает адрес', () => {
    // Адреса правят руками и режут при копировании. Страница ошибки
    // вместо архива — несоразмерный ответ на лишний символ
    expect(parseArchiveFilters({ page: 'абв' }).page).toBe(1)
    expect(parseArchiveFilters({ page: '-2' }).page).toBe(1)
    expect(parseArchiveFilters({ page: '0' }).page).toBe(1)
  })

  it('отбрасывает куратора, не похожего на идентификатор', () => {
    // Значение приходит из адреса, то есть от кого угодно. Проверка формы
    // до запроса дешевле, чем запрос заведомо ни с чем
    expect(parseArchiveFilters({ curator: 'ivan' }).curatorId).toBeNull()
    expect(parseArchiveFilters({ curator: "'; drop table streams" }).curatorId).toBeNull()
  })

  it('обрезает слишком длинный запрос', () => {
    const long = 'а'.repeat(300)

    expect(parseArchiveFilters({ q: long }).query).toHaveLength(100)
  })

  it('берёт первое значение, если параметр пришёл списком', () => {
    expect(parseArchiveFilters({ q: ['баррэ', 'бой'] }).query).toBe('баррэ')
  })

  it('считает пустую строку отсутствием фильтра', () => {
    expect(parseArchiveFilters({ q: '   ' }).query).toBeNull()
  })
})

describe('buildArchiveQuery', () => {
  it('не пишет в адрес значения по умолчанию', () => {
    expect(buildArchiveQuery({ page: 1 })).toBe('')
    expect(buildArchiveQuery({})).toBe('')
  })

  it('собирает адрес из заданных фильтров', () => {
    expect(buildArchiveQuery({ query: 'баррэ', page: 2 })).toBe('?q=%D0%B1%D0%B0%D1%80%D1%80%D1%8D&page=2') // prettier-ignore
  })

  it('возвращает то же самое после разбора', () => {
    const filters = { query: 'бой', curatorId: CURATOR, page: 4 }

    expect(parseArchiveFilters(fromQuery(buildArchiveQuery(filters)))).toEqual(filters)
  })
})

describe('archiveOffset', () => {
  it('на первой странице ничего не пропускает', () => {
    expect(archiveOffset(1)).toBe(0)
  })

  it('пропускает по странице на каждый шаг', () => {
    expect(archiveOffset(3)).toBe(archiveOffset(2) * 2)
  })
})

describe('hasArchiveFilters', () => {
  it('различает пустой архив и пустую выдачу поиска', () => {
    // От этого зависит текст на пустом экране: «ничего не нашлось»
    // лечится сбросом фильтра, «записей ещё нет» — нет
    expect(hasArchiveFilters({ query: null, curatorId: null, page: 2 })).toBe(false)
    expect(hasArchiveFilters({ query: 'баррэ', curatorId: null, page: 1 })).toBe(true)
    expect(hasArchiveFilters({ query: null, curatorId: CURATOR, page: 1 })).toBe(true)
  })
})

describe('searchTerms', () => {
  it('разбивает запрос на слова для подсветки', () => {
    expect(searchTerms('баррэ и бой')).toEqual(['баррэ', 'бой'])
  })

  it('отбрасывает односимвольные обрывки', () => {
    // Подсветка каждой буквы «и» в списке — шум, а не помощь
    expect(searchTerms('а бой')).toEqual(['бой'])
  })

  it('без запроса не подсвечивает ничего', () => {
    expect(searchTerms(null)).toEqual([])
  })
})

/** Разбор собранного адреса обратно в параметры — как это делает Next.js */
function fromQuery(query: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(query))
}
