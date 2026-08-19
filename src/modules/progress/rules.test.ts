import { describe, expect, it } from 'vitest'

import {
  completionPercent,
  COMPLETION_THRESHOLD_PERCENT,
  isCompleted,
  mergePercent,
  nextIncomplete,
  progressStatus,
  remainingMinutes,
  toPercent,
} from './rules'

/**
 * Тесты правил прохождения.
 *
 * Проверяются два вида ошибок, которые человек воспринимает совершенно
 * по-разному: «прошёл, а не засчитали» — поломка, «засчитали то, чего
 * не смотрел» — обман. Обе появляются здесь, в арифметике.
 */

describe('progressStatus', () => {
  it('отсутствие записи — это «не начато»', () => {
    expect(progressStatus(null)).toBe('not_started')
  })

  it('случайное нажатие не считается началом', () => {
    expect(progressStatus({ percent: 1, completedManually: false })).toBe('not_started')
  })

  it('середина ролика — «в процессе»', () => {
    expect(progressStatus({ percent: 40, completedManually: false })).toBe('in_progress')
  })

  it('порог просмотра — «пройдено»', () => {
    expect(
      progressStatus({ percent: COMPLETION_THRESHOLD_PERCENT, completedManually: false }),
    ).toBe('completed')
  })
})

describe('isCompleted', () => {
  it('титры смотреть не обязательно', () => {
    // 90 процентов, а не 100: в конце прощание куратора и «увидимся»
    expect(isCompleted({ percent: 92, completedManually: false })).toBe(true)
    expect(isCompleted({ percent: 88, completedManually: false })).toBe(false)
  })

  it('ручная отметка сильнее автоматики', () => {
    // Смотрел с телефона на кухне и нажал «пройден» — значит прошёл
    expect(isCompleted({ percent: 0, completedManually: true })).toBe(true)
  })
})

describe('toPercent', () => {
  it('считает долю просмотренного', () => {
    expect(toPercent(30, 120)).toBe(25)
  })

  it('нулевая длительность не ломает счёт', () => {
    // Так выглядит ещё не обработанное видеохостингом видео
    expect(toPercent(30, 0)).toBe(0)
    expect(toPercent(30, null)).toBe(0)
  })

  it('перемотка за конец не даёт больше ста', () => {
    expect(toPercent(500, 120)).toBe(100)
  })

  it('отрицательное положение не даёт отрицательного процента', () => {
    expect(toPercent(-5, 120)).toBe(0)
  })
})

describe('mergePercent', () => {
  it('перемотка назад не отменяет засчитанное', () => {
    // На разборе гитары назад отматывают постоянно
    expect(mergePercent(80, 20)).toBe(80)
  })

  it('движение вперёд засчитывается', () => {
    expect(mergePercent(20, 80)).toBe(80)
  })
})

describe('completionPercent', () => {
  it('пустой набор — ноль, а не ошибка деления', () => {
    expect(completionPercent({ total: 0, completed: 0 })).toBe(0)
  })

  it('половина пройдена', () => {
    expect(completionPercent({ total: 8, completed: 4 })).toBe(50)
  })

  it('пройдено не всё — показываем не больше 99', () => {
    // Иначе человек с 199 уроками из 200 видит «100%» и считает курс
    // законченным
    expect(completionPercent({ total: 200, completed: 199 })).toBe(99)
  })

  it('всё пройдено — ровно сто', () => {
    expect(completionPercent({ total: 8, completed: 8 })).toBe(100)
  })
})

describe('nextIncomplete', () => {
  const done = (item: { done: boolean }) => item.done

  it('первый непройденный по порядку', () => {
    const items = [{ done: true }, { done: false }, { done: false }]

    expect(nextIncomplete(items, done)).toBe(items[1])
  })

  it('всё пройдено — предлагать нечего', () => {
    expect(nextIncomplete([{ done: true }], done)).toBeNull()
  })

  it('пустой курс — предлагать нечего', () => {
    expect(nextIncomplete([], done)).toBeNull()
  })
})

describe('remainingMinutes', () => {
  it('складывает только непройденное', () => {
    const lessons = [
      { estimatedMinutes: 10, completed: true },
      { estimatedMinutes: 15, completed: false },
      { estimatedMinutes: 5, completed: false },
    ]

    expect(remainingMinutes(lessons)).toBe(20)
  })

  it('уроки без длительности не выдумываются', () => {
    // Обещание, собранное из выдуманных чисел, хуже отсутствия обещания
    expect(
      remainingMinutes([
        { estimatedMinutes: null, completed: false },
        { estimatedMinutes: 10, completed: false },
      ]),
    ).toBe(10)
  })
})
