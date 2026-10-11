import { describe, expect, it } from 'vitest'

import {
  findNeighbours,
  findNextLesson,
  lessonNumber,
  summarizeCourse,
  summarizeModule,
} from './outline'

import type { OutlineModule } from './outline'

/**
 * Тесты устройства курса.
 *
 * Проверяется поведение на границах, где карта курса ошибается обиднее
 * всего: переход между модулями, пропущенный в середине урок,
 * законченный курс и модуль, который куратор ещё не наполнил.
 */

function lesson(id: string, completed: boolean, minutes: number | null = 10) {
  return { id, slug: id, title: id, estimatedMinutes: minutes, completed }
}

function module_(id: string, lessons: ReturnType<typeof lesson>[]): OutlineModule {
  return { id, slug: id, title: id, lessons }
}

const course: OutlineModule[] = [
  module_('m1', [lesson('l1', true), lesson('l2', true)]),
  module_('m2', [lesson('l3', false), lesson('l4', false)]),
  module_('m3', [lesson('l5', false)]),
]

describe('summarizeModule', () => {
  it('считает пройденное', () => {
    const summary = summarizeModule(module_('m', [lesson('a', true), lesson('b', false)]))

    expect(summary).toMatchObject({ total: 2, completed: 1, percent: 50, isComplete: false })
  })

  it('модуль пройден целиком', () => {
    expect(summarizeModule(module_('m', [lesson('a', true)])).isComplete).toBe(true)
  })

  it('пустой модуль пройденным не считается', () => {
    // Куратор его ещё наполняет — показывать «готово» было бы враньём
    const summary = summarizeModule(module_('m', []))

    expect(summary.isComplete).toBe(false)
    expect(summary.percent).toBe(0)
  })

  it('нетронутый модуль виден отдельно', () => {
    expect(summarizeModule(module_('m', [lesson('a', false)])).isUntouched).toBe(true)
  })
})

describe('summarizeCourse', () => {
  it('считает по всем модулям сразу', () => {
    const summary = summarizeCourse(course)

    expect(summary.totalLessons).toBe(5)
    expect(summary.completedLessons).toBe(2)
    expect(summary.totalModules).toBe(3)
  })

  it('оставшееся время — только по непройденным', () => {
    expect(summarizeCourse(course).remainingMinutes).toBe(30)
  })

  it('показывает, в каком модуле человек сейчас', () => {
    expect(summarizeCourse(course).currentModuleNumber).toBe(2)
  })

  it('у законченного курса текущего модуля нет', () => {
    const done = [module_('m1', [lesson('l1', true)])]

    expect(summarizeCourse(done).currentModuleNumber).toBeNull()
    expect(summarizeCourse(done).percent).toBe(100)
  })

  it('пустой курс не ломает счёт', () => {
    expect(summarizeCourse([])).toMatchObject({ totalLessons: 0, percent: 0 })
  })
})

describe('findNextLesson', () => {
  it('первый непройденный по порядку', () => {
    expect(findNextLesson(course)?.lesson.id).toBe('l3')
  })

  it('возвращает к пропущенному уроку в раннем модуле', () => {
    // Человек ушёл вперёд, оставив дыру: без этого она осталась бы навсегда
    const skipped: OutlineModule[] = [
      module_('m1', [lesson('l1', false)]),
      module_('m2', [lesson('l2', true)]),
    ]

    expect(findNextLesson(skipped)?.lesson.id).toBe('l1')
  })

  it('всё пройдено — продолжать нечего', () => {
    expect(findNextLesson([module_('m', [lesson('a', true)])])).toBeNull()
  })

  it('пропускает пустой модуль', () => {
    const withEmpty: OutlineModule[] = [module_('m1', []), module_('m2', [lesson('l1', false)])]

    expect(findNextLesson(withEmpty)?.lesson.id).toBe('l1')
  })
})

describe('findNeighbours', () => {
  it('соседи внутри модуля', () => {
    const { previous, next } = findNeighbours(course, 'l3')

    expect(previous?.lesson.id).toBe('l2')
    expect(next?.lesson.id).toBe('l4')
  })

  it('переход через границу модуля', () => {
    // Упереться в конец модуля и не понять, как двигаться дальше, —
    // самая обидная поломка: выглядит как конец курса
    expect(findNeighbours(course, 'l4').next?.lesson.id).toBe('l5')
    expect(findNeighbours(course, 'l4').next?.module.id).toBe('m3')
  })

  it('у первого урока предыдущего нет', () => {
    expect(findNeighbours(course, 'l1').previous).toBeNull()
  })

  it('у последнего урока следующего нет', () => {
    expect(findNeighbours(course, 'l5').next).toBeNull()
  })

  it('неизвестный урок соседей не имеет', () => {
    expect(findNeighbours(course, 'нет-такого')).toEqual({ previous: null, next: null })
  })
})

describe('lessonNumber', () => {
  it('нумерует сквозь модули', () => {
    // «Урок 5 из 5» понятнее, чем «урок 1 модуля 3»
    expect(lessonNumber(course, 'l5')).toBe(5)
  })

  it('неизвестный урок номера не имеет', () => {
    expect(lessonNumber(course, 'нет-такого')).toBeNull()
  })
})
