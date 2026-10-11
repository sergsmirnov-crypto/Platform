import { describe, expect, it } from 'vitest'

import { findChapterIssues, normalizeChapters } from './chapters'

describe('normalizeChapters', () => {
  it('выстраивает пункты по времени, как бы их ни вписали', () => {
    // Куратор отматывает запись и вспоминает пункты вразнобой —
    // это нормальный способ работы, а не ошибка
    const result = normalizeChapters([
      { title: 'Соло', startSec: 2640 },
      { title: 'Приветствие', startSec: 0 },
      { title: 'Перебор', startSec: 1180 },
    ])

    expect(result.map((chapter) => chapter.title)).toEqual(['Приветствие', 'Перебор', 'Соло'])
  })

  it('проставляет номера подряд, без дыр', () => {
    const result = normalizeChapters([
      { title: 'Второй', startSec: 100 },
      { title: 'Первый', startSec: 10 },
    ])

    expect(result.map((chapter) => chapter.orderIndex)).toEqual([0, 1])
  })

  it('выбрасывает пункты без названия', () => {
    // Строка добавляется до того, как в неё печатают: незаполненная
    // не должна доехать до оглавления участника
    const result = normalizeChapters([
      { title: 'Соло', startSec: 200 },
      { title: '   ', startSec: 300 },
    ])

    expect(result).toHaveLength(1)
  })

  it('на одно время оставляет один пункт', () => {
    const result = normalizeChapters([
      { title: 'Верный', startSec: 60 },
      { title: 'Опечатка', startSec: 60 },
    ])

    expect(result).toEqual([{ title: 'Верный', startSec: 60, orderIndex: 0 }])
  })

  it('обрезает пробелы в названиях', () => {
    expect(normalizeChapters([{ title: '  Соло  ', startSec: 5 }])[0]?.title).toBe('Соло')
  })

  it('отрицательное время считает началом записи', () => {
    expect(normalizeChapters([{ title: 'Начало', startSec: -30 }])[0]?.startSec).toBe(0)
  })

  it('пустой список остаётся пустым', () => {
    expect(normalizeChapters([])).toEqual([])
  })
})

describe('findChapterIssues', () => {
  it('молчит, когда всё заполнено', () => {
    expect(
      findChapterIssues([
        { title: 'Приветствие', startSec: 0 },
        { title: 'Соло', startSec: 2640 },
      ]),
    ).toEqual([])
  })

  it('не ругается на совсем пустую строку', () => {
    // Куратор нажал «Добавить пункт» и ещё не начал печатать
    expect(findChapterIssues([{ title: '', startSec: null }])).toEqual([])
  })

  it('замечает название без времени', () => {
    const issues = findChapterIssues([{ title: 'Соло', startSec: null }])

    expect(issues).toHaveLength(1)
    expect(issues[0]?.index).toBe(0)
  })

  it('замечает время без названия', () => {
    expect(findChapterIssues([{ title: '  ', startSec: 120 }])).toHaveLength(1)
  })

  it('показывает, с каким пунктом совпало время', () => {
    const issues = findChapterIssues([
      { title: 'Первый', startSec: 60 },
      { title: 'Второй', startSec: 60 },
    ])

    // Номер человеческий, с единицы: куратор считает строки глазами
    expect(issues[0]?.message).toContain('пунктом 1')
    expect(issues[0]?.index).toBe(1)
  })
})
