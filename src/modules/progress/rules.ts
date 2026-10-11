import type { ProgressStatus } from './schema'

/**
 * Правила прохождения.
 *
 * Ни базы, ни сети — только арифметика и решения. Поэтому файл покрыт
 * тестами целиком: ошибка здесь означает либо «прошёл, а не засчитали»,
 * либо «засчитали то, чего не смотрел». Первое человек воспринимает
 * как поломку, второе — как обман.
 */

/**
 * Доля ролика, после которой урок считается пройденным.
 *
 * Не сто процентов: в конце ролика прощание куратора, титры и «увидимся
 * на эфире». Человек закрывает вкладку раньше — и это нормальное
 * поведение, а не незавершённый урок.
 */
export const COMPLETION_THRESHOLD_PERCENT = 90

/** Ниже этого просмотр не считается началом: случайно нажал и ушёл */
const START_THRESHOLD_PERCENT = 2

export type ProgressSnapshot = {
  percent: number
  completedManually: boolean
}

/**
 * Состояние объекта по его прогрессу.
 *
 * Отсутствие строки — «не начато». Отдельная проверка на `null` в каждом
 * месте, где показывается кольцо прогресса, превратилась бы в источник
 * ошибок «пустой прогресс выглядит как пройденный».
 */
export function progressStatus(snapshot: ProgressSnapshot | null): ProgressStatus {
  if (!snapshot) return 'not_started'

  if (isCompleted(snapshot)) return 'completed'
  if (snapshot.percent < START_THRESHOLD_PERCENT) return 'not_started'

  return 'in_progress'
}

/**
 * Пройдено ли.
 *
 * Ручная отметка сильнее автоматики и никогда ею не снимается. Человек,
 * посмотревший урок с телефона на кухне и нажавший «пройден», не должен
 * обнаружить его снова непройденным только потому, что до конца ролика
 * не досмотрел.
 */
export function isCompleted(snapshot: ProgressSnapshot): boolean {
  return snapshot.completedManually || snapshot.percent >= COMPLETION_THRESHOLD_PERCENT
}

/**
 * Приводит долю просмотра к целому от 0 до 100.
 *
 * Отдельная функция, потому что источники разные и все врут по-своему:
 * плеер присылает дробь, длительность ролика бывает нулевой у ещё
 * не обработанного видео, а перемотка в конец даёт значение больше
 * длительности.
 */
export function toPercent(positionSec: number, durationSec: number | null): number {
  if (!durationSec || durationSec <= 0) return 0
  if (positionSec <= 0) return 0

  return Math.min(100, Math.round((positionSec / durationSec) * 100))
}

/**
 * Новое значение доли просмотра.
 *
 * Максимум из старого и нового: перемотка назад, чтобы переслушать
 * трудное место, не должна отменять уже засчитанный просмотр. Это
 * поведение важнее точности — на разборе гитары назад отматывают
 * постоянно.
 */
export function mergePercent(previous: number, next: number): number {
  return Math.max(previous, next)
}

export type CompletionCount = { total: number; completed: number }

/**
 * Процент прохождения набора уроков.
 *
 * Округление вниз, но с оговоркой: пока пройдено не всё, показывать 100%
 * нельзя. Иначе человек, прошедший 199 уроков из 200, видит «100%»
 * и считает курс законченным.
 */
export function completionPercent({ total, completed }: CompletionCount): number {
  if (total <= 0) return 0
  if (completed >= total) return 100

  return Math.min(99, Math.floor((completed / total) * 100))
}

/**
 * Следующий незакрытый элемент.
 *
 * Возвращает первый непройденный по порядку — то, что карта курса
 * подсвечивает как «сюда». Если пройдено всё, ответа нет: курс закончен,
 * и предлагать «продолжить» некуда.
 */
export function nextIncomplete<T>(items: T[], isDone: (item: T) => boolean): T | null {
  return items.find((item) => !isDone(item)) ?? null
}

/**
 * Сколько времени осталось.
 *
 * Считается по непройденным урокам. Уроки без указанной длительности
 * пропускаются, а не заменяются средним: обещание «осталось 40 минут»,
 * собранное из выдуманных чисел, хуже отсутствия обещания.
 */
export function remainingMinutes(
  lessons: { estimatedMinutes: number | null; completed: boolean }[],
): number {
  return lessons
    .filter((lesson) => !lesson.completed)
    .reduce((sum, lesson) => sum + (lesson.estimatedMinutes ?? 0), 0)
}
