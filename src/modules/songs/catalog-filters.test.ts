import { describe, expect, it } from 'vitest'

import {
  buildCatalogQuery,
  CATALOG_PRESETS,
  DEFAULT_SORT,
  hasActiveFilters,
  isPresetActive,
  pageCount,
  pageOffset,
  parseCatalogFilters,
} from './catalog-filters'

/**
 * Тесты разбора фильтров.
 *
 * Главное свойство, ради которого они написаны: **мусор в адресе
 * не ломает каталог.** Адрес правят руками, присылают друг другу
 * и режут при копировании. Страница ошибки вместо списка разборов —
 * несоразмерный ответ на лишнюю запятую в ссылке.
 */

describe('parseCatalogFilters', () => {
  it('пустой адрес даёт разумные значения по умолчанию', () => {
    const filters = parseCatalogFilters({})

    expect(filters).toEqual({
      query: null,
      levels: [],
      tunings: [],
      tags: [],
      curatorId: null,
      maxMinutes: null,
      sort: DEFAULT_SORT,
      page: 1,
      includeDrafts: false,
    })
  })

  it('понимает повторяющиеся параметры', () => {
    const filters = parseCatalogFilters({ level: ['beginner', 'advanced'] })

    expect(filters.levels).toEqual(['beginner', 'advanced'])
  })

  it('понимает перечисление через запятую', () => {
    const filters = parseCatalogFilters({ level: 'beginner,advanced' })

    expect(filters.levels).toEqual(['beginner', 'advanced'])
  })

  it('убирает повторы', () => {
    expect(parseCatalogFilters({ level: 'beginner,beginner' }).levels).toEqual(['beginner'])
  })

  it('молча выбрасывает несуществующий уровень', () => {
    const filters = parseCatalogFilters({ level: 'beginner,надёжный' })

    expect(filters.levels).toEqual(['beginner'])
  })

  it('молча выбрасывает несуществующий строй', () => {
    expect(parseCatalogFilters({ tuning: 'дроп ре' }).tunings).toEqual([])
  })

  it('неизвестная сортировка заменяется на обычную', () => {
    expect(parseCatalogFilters({ sort: 'по-настроению' }).sort).toBe(DEFAULT_SORT)
  })

  it.each([['0'], ['-3'], ['страница'], ['']])('негодный номер страницы %p → первая', (page) => {
    expect(parseCatalogFilters({ page }).page).toBe(1)
  })

  it('обрезает слишком длинный поисковый запрос', () => {
    const filters = parseCatalogFilters({ q: 'а'.repeat(500) })

    expect(filters.query?.length).toBe(100)
  })

  it('пробелы по краям не считаются запросом', () => {
    expect(parseCatalogFilters({ q: '   ' }).query).toBeNull()
  })

  it('ограничивает число меток', () => {
    const filters = parseCatalogFilters({ tag: Array.from({ length: 30 }, (_, i) => `t${i}`) })

    expect(filters.tags).toHaveLength(10)
  })

  it('черновики из адреса не включаются: это решают права, а не ссылка', () => {
    expect(parseCatalogFilters({ includeDrafts: 'true' }).includeDrafts).toBe(false)
  })
})

describe('hasActiveFilters', () => {
  it('пустой набор — фильтров нет', () => {
    expect(hasActiveFilters(parseCatalogFilters({}))).toBe(false)
  })

  it('сортировка и страница фильтрами не считаются', () => {
    expect(hasActiveFilters(parseCatalogFilters({ sort: 'popular', page: '3' }))).toBe(false)
  })

  it.each([
    [{ q: 'кино' }],
    [{ level: 'beginner' }],
    [{ tuning: 'drop_d' }],
    [{ tag: 'rock' }],
    [{ minutes: '60' }],
  ])('выбор %p считается фильтром', (params) => {
    expect(hasActiveFilters(parseCatalogFilters(params))).toBe(true)
  })
})

describe('buildCatalogQuery', () => {
  it('пустые фильтры дают чистый адрес', () => {
    expect(buildCatalogQuery(parseCatalogFilters({}))).toBe('')
  })

  it('значения по умолчанию в адрес не пишутся', () => {
    expect(buildCatalogQuery({ sort: DEFAULT_SORT, page: 1 })).toBe('')
  })

  it('разбор адреса и сборка обратно дают то же самое', () => {
    const filters = parseCatalogFilters({
      level: ['beginner', 'advanced'],
      tuning: 'drop_d',
      sort: 'popular',
      page: '2',
    })

    // Собранный адрес разбираем заново — должно получиться исходное
    const params: Record<string, string[]> = {}
    for (const [key, value] of new URLSearchParams(buildCatalogQuery(filters))) {
      params[key] = [...(params[key] ?? []), value]
    }

    expect(parseCatalogFilters(params)).toEqual(filters)
  })
})

describe('ограничение по времени разбора', () => {
  it('читается из адреса', () => {
    expect(parseCatalogFilters({ minutes: '60' }).maxMinutes).toBe(60)
  })

  it.each([['0'], ['-5'], ['вечер'], ['']])('негодное значение %p не применяется', (minutes) => {
    expect(parseCatalogFilters({ minutes }).maxMinutes).toBeNull()
  })

  it('слишком большое значение обрезается', () => {
    expect(parseCatalogFilters({ minutes: '99999' }).maxMinutes).toBe(600)
  })
})

describe('подборки', () => {
  it('«Для новичка» считается выбранной при фильтре по уровню', () => {
    const preset = CATALOG_PRESETS.find((item) => item.value === 'beginner')

    expect(isPresetActive(preset!, parseCatalogFilters({ level: 'beginner' }))).toBe(true)
  })

  it('остаётся выбранной, если человек добавил ещё один фильтр', () => {
    const preset = CATALOG_PRESETS.find((item) => item.value === 'beginner')
    const filters = parseCatalogFilters({ level: 'beginner', tuning: 'drop_d' })

    expect(isPresetActive(preset!, filters)).toBe(true)
  })

  it('не считается выбранной, когда её условия не выполнены', () => {
    const preset = CATALOG_PRESETS.find((item) => item.value === 'beginner')

    expect(isPresetActive(preset!, parseCatalogFilters({ level: 'advanced' }))).toBe(false)
  })

  it('у каждой подборки задан хотя бы один фильтр', () => {
    for (const preset of CATALOG_PRESETS) {
      expect(Object.keys(preset.filters).length).toBeGreaterThan(0)
    }
  })
})

describe('страницы', () => {
  it('первая страница ничего не пропускает', () => {
    expect(pageOffset(1, 24)).toBe(0)
  })

  it('третья пропускает две страницы', () => {
    expect(pageOffset(3, 24)).toBe(48)
  })

  it('пустой каталог — всё равно одна страница', () => {
    expect(pageCount(0, 24)).toBe(1)
  })

  it('остаток занимает отдельную страницу', () => {
    expect(pageCount(25, 24)).toBe(2)
  })
})
