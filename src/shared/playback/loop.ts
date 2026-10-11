/**
 * Зацикливание отрезка записи (A–B).
 *
 * Ни плеера, ни браузера — только числа. Отсюда правило: всё, что можно
 * ошибиться в зацикливании, проверяется тестом, а не отлавливается
 * на слух с гитарой в руках.
 */

export type LoopRange = {
  /** Начало отрезка в секундах */
  from: number
  /** Конец отрезка в секундах */
  to: number
}

/**
 * Кратчайший отрезок, который имеет смысл зацикливать.
 *
 * Полторы секунды — это примерно один такт в среднем темпе. Короче
 * получается не отработка, а дребезг: плеер не успевает разогнаться
 * после перемотки, и человек слышит щелчки вместо музыки.
 */
export const MIN_LOOP_SECONDS = 1.5

/**
 * Собрать отрезок из двух отметок.
 *
 * Порядок отметок не важен: человек может поставить B раньше A, отмотав
 * назад, и требовать от него правильной последовательности — значит
 * заставлять переделывать вместо того, чтобы понять.
 *
 * Возвращает `null`, если отрезок слишком короткий: это не ошибка,
 * а «пока рано» — вторая отметка ещё не поставлена осмысленно.
 */
export function makeLoop(first: number, second: number): LoopRange | null {
  const from = Math.max(0, Math.min(first, second))
  const to = Math.max(first, second)

  if (to - from < MIN_LOOP_SECONDS) return null

  return { from, to }
}

/**
 * Пора ли возвращаться к началу отрезка.
 *
 * ─────────────────────────────────────────────────────────────────
 * ВОЗВРАЩАЕМСЯ ЧУТЬ РАНЬШЕ КОНЦА, А НЕ ПО ЕГО ДОСТИЖЕНИИ
 *
 * Плеер сообщает о времени несколько раз в секунду, а не непрерывно.
 * Проверка «время больше конца» срабатывает уже за концом отрезка —
 * человек успевает услышать начало следующего такта, и петля звучит
 * длиннее, чем он её поставил.
 *
 * Упреждение в четверть секунды примерно равно шагу событий плеера.
 * Слышимой обрезки на такой величине нет, а «залезание» за край
 * пропадает.
 * ─────────────────────────────────────────────────────────────────
 */
const LOOP_LOOKAHEAD_SECONDS = 0.25

export function shouldRestartLoop(currentTime: number, loop: LoopRange | null): boolean {
  if (!loop) return false

  // Позади начала — значит человек сам отмотал назад: возвращать его
  // вперёд было бы борьбой с ним же
  if (currentTime < loop.from) return false

  return currentTime >= loop.to - LOOP_LOOKAHEAD_SECONDS
}

/**
 * Отрезок под границы записи.
 *
 * Длительность приходит от плеера и может быть неизвестна: тогда
 * подрезать нечем и отрезок остаётся как есть.
 */
export function clampLoop(loop: LoopRange, duration: number | null): LoopRange | null {
  if (duration === null || duration <= 0) return loop

  const from = Math.max(0, Math.min(loop.from, duration))
  const to = Math.min(loop.to, duration)

  if (to - from < MIN_LOOP_SECONDS) return null

  return { from, to }
}

/**
 * Отрезок из части разбора.
 *
 * Части со своим отдельным роликом отрезка не дают: там другое видео,
 * а не кусок этого.
 */
export function loopFromSection(section: {
  startSec: number | null
  endSec: number | null
}): LoopRange | null {
  if (section.startSec === null || section.endSec === null) return null

  return makeLoop(section.startSec, section.endSec)
}
