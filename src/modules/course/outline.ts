import { completionPercent, nextIncomplete, remainingMinutes } from '@/modules/progress'

/**
 * Правила устройства курса.
 *
 * Ни базы, ни сети. Здесь живёт всё, что отвечает на вопросы карты
 * курса: где я нахожусь, сколько осталось, куда идти дальше.
 *
 * ─────────────────────────────────────────────────────────────────
 * УРОКИ НЕ ЗАПИРАЮТСЯ
 *
 * Классический курс не пускает в урок 5, пока не пройден урок 4.
 * У нас открыт любой, а следующий незакрытый только выделяется.
 *
 * Причина продуктовая и та же, по которой в проекте нет «стриков»:
 * взрослый человек с гитарой приходит с конкретным вопросом («как
 * ставить баррэ»), находит его в третьем модуле и упирается в замок.
 * Он не пойдёт проходить два модуля ради ответа — он закроет вкладку.
 * Замок защищает методику ценой оттока.
 *
 * Если решение когда-нибудь изменится, менять придётся только этот
 * файл и карту курса: в базе никакой блокировки не заложено.
 * ─────────────────────────────────────────────────────────────────
 */

export type OutlineLesson = {
  id: string
  slug: string
  title: string
  estimatedMinutes: number | null
  completed: boolean
}

export type OutlineModule = {
  id: string
  slug: string
  title: string
  lessons: OutlineLesson[]
}

/** Итоги по модулю: то, что показывается в его заголовке на карте */
export type ModuleSummary = {
  total: number
  completed: number
  percent: number
  /** Все уроки пройдены — модуль на карте сворачивается */
  isComplete: boolean
  /** Ни одного не начато: модуль ещё впереди */
  isUntouched: boolean
}

export function summarizeModule(module: OutlineModule): ModuleSummary {
  const total = module.lessons.length
  const completed = module.lessons.filter((lesson) => lesson.completed).length

  return {
    total,
    completed,
    percent: completionPercent({ total, completed }),
    // Пустой модуль пройденным не считается: куратор его ещё наполняет,
    // и показывать участнику «готово» было бы враньём
    isComplete: total > 0 && completed === total,
    isUntouched: completed === 0,
  }
}

export type CourseSummary = {
  totalLessons: number
  completedLessons: number
  percent: number
  remainingMinutes: number
  /** Номер модуля, в котором человек сейчас: «Модуль 3 из 8» */
  currentModuleNumber: number | null
  totalModules: number
}

export function summarizeCourse(modules: OutlineModule[]): CourseSummary {
  const lessons = modules.flatMap((module) => module.lessons)
  const completedLessons = lessons.filter((lesson) => lesson.completed).length

  const next = findNextLesson(modules)
  const currentIndex = next
    ? modules.findIndex((module) => module.lessons.some((lesson) => lesson.id === next.lesson.id))
    : -1

  return {
    totalLessons: lessons.length,
    completedLessons,
    percent: completionPercent({ total: lessons.length, completed: completedLessons }),
    remainingMinutes: remainingMinutes(lessons),
    currentModuleNumber: currentIndex >= 0 ? currentIndex + 1 : null,
    totalModules: modules.length,
  }
}

export type NextLesson = {
  module: OutlineModule
  lesson: OutlineLesson
}

/**
 * Куда идти дальше.
 *
 * Первый непройденный урок по порядку — по всем модулям подряд, а не
 * внутри текущего. Человек, пропустивший урок в первом модуле и ушедший
 * в третий, при следующем заходе должен вернуться к пропущенному:
 * иначе дыра в курсе останется навсегда.
 *
 * `null` означает, что пройдено всё. Предлагать «продолжить» законченный
 * курс нельзя — это выглядит как поломка.
 */
export function findNextLesson(modules: OutlineModule[]): NextLesson | null {
  // Переменная называется не `module`: это зарезервированное слово
  // в модульной системе, и сборщик Next.js на него ругается
  for (const courseModule of modules) {
    const lesson = nextIncomplete(courseModule.lessons, (item) => item.completed)
    if (lesson) return { module: courseModule, lesson }
  }

  return null
}

export type LessonNeighbours = {
  previous: NextLesson | null
  next: NextLesson | null
}

/**
 * Соседние уроки для навигации «← предыдущий / следующий →».
 *
 * Переход через границу модуля обязателен: для человека курс — это одна
 * дорожка, а деление на модули он воспринимает как главы книги.
 * Упереться в конец модуля и не понять, как двигаться дальше, — самая
 * обидная поломка навигации, потому что выглядит она как конец курса.
 */
export function findNeighbours(modules: OutlineModule[], lessonId: string): LessonNeighbours {
  const flat = modules.flatMap((module) => module.lessons.map((lesson) => ({ module, lesson })))

  const index = flat.findIndex((item) => item.lesson.id === lessonId)
  if (index === -1) return { previous: null, next: null }

  return {
    previous: flat[index - 1] ?? null,
    next: flat[index + 1] ?? null,
  }
}

/** Сквозной номер урока: «Урок 12 из 40» понятнее, чем «урок 2 модуля 3» */
export function lessonNumber(modules: OutlineModule[], lessonId: string): number | null {
  const flat = modules.flatMap((module) => module.lessons)
  const index = flat.findIndex((lesson) => lesson.id === lessonId)

  return index === -1 ? null : index + 1
}
