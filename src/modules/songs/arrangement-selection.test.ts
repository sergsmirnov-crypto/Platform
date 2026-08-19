import { describe, expect, it } from 'vitest'

import {
  groupByLevel,
  hasVariantChoice,
  nearestLevel,
  selectArrangement,
  variantLabel,
} from './arrangement-selection'

import type { SelectableArrangement } from './arrangement-selection'
import type { Level } from './domain'

function make(id: string, level: Level, title: string | null = null): SelectableArrangement {
  return { id, level, title }
}

const beginner = make('a1', 'beginner', 'Акустика, упрощённо')
const intermediate = make('a2', 'intermediate', 'Как в оригинале')
const intermediateTwo = make('a3', 'intermediate', 'Фингерстайл')
const advanced = make('a4', 'advanced')

const ALL = [advanced, intermediate, beginner, intermediateTwo]

const NO_REQUEST = { requestedLevel: null, requestedId: null, profileLevel: null }

describe('groupByLevel', () => {
  it('раскладывает варианты по уровням от простого к сложному', () => {
    const groups = groupByLevel(ALL)

    expect(groups.map((group) => group.level)).toEqual(['beginner', 'intermediate', 'advanced'])
  })

  it('складывает несколько вариантов одного уровня в одну группу', () => {
    const groups = groupByLevel(ALL)

    expect(groups[1]?.arrangements).toEqual([intermediate, intermediateTwo])
  })

  it('не создаёт пустых уровней', () => {
    // Показывать вкладку «Продвинутый» без разбора — обещать несуществующее
    const groups = groupByLevel([beginner])

    expect(groups).toHaveLength(1)
  })

  it('на пустом списке возвращает пустой результат', () => {
    expect(groupByLevel([])).toEqual([])
  })
})

describe('nearestLevel', () => {
  it('отдаёт запрошенный уровень, если он есть', () => {
    expect(nearestLevel(['beginner', 'advanced'], 'advanced')).toBe('advanced')
  })

  it('при отсутствии уровня берёт тот, что проще', () => {
    // Разобрать песню ниже своего уровня скучно, но возможно
    expect(nearestLevel(['beginner', 'intermediate'], 'advanced')).toBe('intermediate')
  })

  it('если проще ничего нет, берёт самый простой из тех, что сложнее', () => {
    expect(nearestLevel(['intermediate', 'advanced'], 'beginner')).toBe('intermediate')
  })

  it('на пустом списке возвращает null', () => {
    expect(nearestLevel([], 'beginner')).toBeNull()
  })
})

describe('selectArrangement', () => {
  it('без всяких пожеланий открывает самый простой уровень', () => {
    const selection = selectArrangement(ALL, NO_REQUEST)

    expect(selection.arrangement).toBe(beginner)
  })

  it('уважает уровень из адреса', () => {
    const selection = selectArrangement(ALL, { ...NO_REQUEST, requestedLevel: 'advanced' })

    expect(selection.arrangement).toBe(advanced)
  })

  it('уважает конкретный вариант из адреса', () => {
    const selection = selectArrangement(ALL, { ...NO_REQUEST, requestedId: 'a3' })

    expect(selection.arrangement).toBe(intermediateTwo)
  })

  it('вариант из адреса важнее уровня из адреса', () => {
    // Ссылка на конкретный разбор — самое явное намерение, какое бывает
    const selection = selectArrangement(ALL, {
      ...NO_REQUEST,
      requestedLevel: 'beginner',
      requestedId: 'a4',
    })

    expect(selection.arrangement).toBe(advanced)
  })

  it('несуществующий вариант в адресе не ломает страницу', () => {
    const selection = selectArrangement(ALL, { ...NO_REQUEST, requestedId: 'нет-такого' })

    expect(selection.arrangement).toBe(beginner)
  })

  it('уровень, которого у песни нет, не подменяется ближайшим', () => {
    // Иначе человек примет разбор для начинающих за продвинутый
    const selection = selectArrangement([beginner, intermediate], {
      ...NO_REQUEST,
      requestedLevel: 'advanced',
      profileLevel: 'beginner',
    })

    expect(selection.arrangement).toBe(beginner)
  })

  it('без указаний в адресе подбирает уровень по профилю', () => {
    const selection = selectArrangement(ALL, { ...NO_REQUEST, profileLevel: 'advanced' })

    expect(selection.arrangement).toBe(advanced)
  })

  it('подбирает ближайший уровень, если нужного у песни нет', () => {
    const selection = selectArrangement([beginner, advanced], {
      ...NO_REQUEST,
      profileLevel: 'intermediate',
    })

    expect(selection.arrangement).toBe(beginner)
  })

  it('адрес важнее профиля', () => {
    const selection = selectArrangement(ALL, {
      ...NO_REQUEST,
      requestedLevel: 'beginner',
      profileLevel: 'advanced',
    })

    expect(selection.arrangement).toBe(beginner)
  })

  it('отдаёт соседние варианты выбранного уровня', () => {
    const selection = selectArrangement(ALL, { ...NO_REQUEST, requestedLevel: 'intermediate' })

    expect(selection.siblings).toEqual([intermediate, intermediateTwo])
  })

  it('у песни без разборов возвращает пустой выбор, а не ошибку', () => {
    const selection = selectArrangement([], NO_REQUEST)

    expect(selection).toEqual({ arrangement: null, groups: [], siblings: [] })
  })
})

describe('hasVariantChoice', () => {
  it('один вариант — второй ряд переключателя не нужен', () => {
    expect(hasVariantChoice([beginner])).toBe(false)
  })

  it('два варианта — нужен', () => {
    expect(hasVariantChoice([intermediate, intermediateTwo])).toBe(true)
  })
})

describe('variantLabel', () => {
  it('берёт название варианта, если куратор его заполнил', () => {
    expect(variantLabel({ title: 'На акустике', curator: null }, 0)).toBe('На акустике')
  })

  it('без названия подставляет имя куратора', () => {
    expect(variantLabel({ title: null, curator: { displayName: 'Иван Петров' } }, 0)).toBe(
      'Иван Петров',
    )
  })

  it('без названия и куратора остаётся порядковый номер', () => {
    expect(variantLabel({ title: null, curator: null }, 1)).toBe('Вариант 2')
  })
})
