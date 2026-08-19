import { describe, expect, it } from 'vitest'

import {
  buildMemberQuery,
  DEFAULT_MEMBER_FILTERS,
  hasActiveMemberFilters,
  parseMemberFilters,
} from './directory-filters'

describe('разбор параметров списка участников', () => {
  it('пустой адрес даёт значения по умолчанию', () => {
    expect(parseMemberFilters({})).toEqual(DEFAULT_MEMBER_FILTERS)
  })

  it('поисковый запрос обрезается по краям', () => {
    expect(parseMemberFilters({ q: '  Казань ' }).query).toBe('Казань')
  })

  it('пустой поисковый запрос считается отсутствующим', () => {
    expect(parseMemberFilters({ q: '   ' }).query).toBeNull()
  })

  it('неизвестное состояние доступа отбрасывается', () => {
    expect(parseMemberFilters({ access: 'хмм' }).access).toBeNull()
  })

  it('известное состояние доступа принимается', () => {
    expect(parseMemberFilters({ access: 'grace' }).access).toBe('grace')
  })

  it('неизвестный порядок заменяется на порядок по умолчанию', () => {
    expect(parseMemberFilters({ sort: 'random' }).sort).toBe('recent')
  })

  it('отрицательная страница становится первой', () => {
    expect(parseMemberFilters({ page: '-3' }).page).toBe(1)
  })

  it('нечисловая страница становится первой', () => {
    expect(parseMemberFilters({ page: 'вторая' }).page).toBe(1)
  })

  it('признаки команды и блокировки читаются из единицы', () => {
    const filters = parseMemberFilters({ team: '1', blocked: '1' })

    expect(filters.team).toBe(true)
    expect(filters.blocked).toBe(true)
  })

  it('повторяющийся параметр берётся по первому значению', () => {
    expect(parseMemberFilters({ q: ['Иван', 'Пётр'] }).query).toBe('Иван')
  })
})

describe('сборка адреса', () => {
  it('значения по умолчанию в адрес не попадают', () => {
    expect(buildMemberQuery(DEFAULT_MEMBER_FILTERS)).toBe('')
  })

  it('отбор попадает в адрес', () => {
    expect(buildMemberQuery({ access: 'expired', team: true })).toBe('?access=expired&team=1')
  })

  it('первая страница в адрес не попадает', () => {
    expect(buildMemberQuery({ page: 1 })).toBe('')
    expect(buildMemberQuery({ page: 3 })).toBe('?page=3')
  })

  it('разбор и сборка возвращают то же самое', () => {
    const source = { q: 'Иван', access: 'active', team: '1', sort: 'name', page: '2' }
    const filters = parseMemberFilters(source)

    expect(parseMemberFilters(readQuery(buildMemberQuery(filters)))).toEqual(filters)
  })
})

describe('подсказка о включённом отборе', () => {
  it('без отбора — ничего не включено', () => {
    expect(hasActiveMemberFilters(DEFAULT_MEMBER_FILTERS)).toBe(false)
  })

  it('порядок и страница отбором не считаются', () => {
    expect(hasActiveMemberFilters({ ...DEFAULT_MEMBER_FILTERS, sort: 'name', page: 4 })).toBe(false)
  })

  it('поиск считается отбором', () => {
    expect(hasActiveMemberFilters({ ...DEFAULT_MEMBER_FILTERS, query: 'Иван' })).toBe(true)
  })
})

/** Обратное преобразование адреса в набор параметров — только для теста */
function readQuery(query: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(query.replace(/^\?/, '')))
}
