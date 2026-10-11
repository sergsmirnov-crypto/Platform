import { compareLevels, LEVEL_VALUES } from './domain'

import type { Level } from './domain'

/**
 * Порядок попыток подобрать первый разбор.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗАЧЕМ ЛЕСТНИЦА ПОПЫТОК, А НЕ ОДИН ЗАПРОС
 *
 * Экран «твой первый шаг» существует ради одной кнопки. Кнопка, ведущая
 * в никуда, хуже отсутствия экрана: человек нажимает и попадает на пустой
 * каталог — то есть получает ровно то первое впечатление, которого мы
 * избегали, плюс ощущение сломанной платформы.
 *
 * Поэтому подбор — это последовательность попыток от точной к грубой.
 * Пустота на всех попытках означает, что публиковать пока нечего, и тогда
 * экран не показывается вовсе: молчание честнее битой кнопки.
 *
 * Функция чистая — она только перечисляет попытки. Выполняет их сервис.
 * Так порядок попыток проверяется тестом без базы, а он и есть самое
 * хрупкое место: перепутанный порядок незаметен, пока в клубе есть
 * разборы всех уровней.
 * ─────────────────────────────────────────────────────────────────
 */
export type StarterAttempt = {
  level: Level | null
  genres: string[]
  /** Зачем эта попытка нужна. Уходит в журнал: видно, как подобралось */
  reason: string
}

export function starterAttempts(criteria: {
  level: Level | null
  genres: string[]
}): StarterAttempt[] {
  const attempts: StarterAttempt[] = []
  const { level, genres } = criteria

  if (level && genres.length > 0) {
    attempts.push({ level, genres, reason: 'уровень и жанры' })
  }

  if (level) {
    attempts.push({ level, genres: [], reason: 'уровень' })

    // Соседний уровень: у новичка в клубе без разборов для начинающих
    // лучше открыть уверенный уровень, чем ничего. Разница в сложности
    // переносима, отсутствие первого разбора — нет
    const neighbour = neighbourLevel(level)
    if (neighbour) {
      attempts.push({ level: neighbour, genres: [], reason: 'соседний уровень' })
    }
  }

  if (genres.length > 0) {
    attempts.push({ level: null, genres, reason: 'жанры' })
  }

  attempts.push({ level: null, genres: [], reason: 'любой свежий разбор' })

  return attempts
}

/**
 * Уровень по соседству, в сторону простоты.
 *
 * От продвинутого — к уверенному, от уверенного — к начинающему. Начинающий
 * соседа не получает: предлагать новичку продвинутый разбор в качестве
 * первого — надёжный способ отбить желание продолжать.
 */
function neighbourLevel(level: Level): Level | null {
  const easier = LEVEL_VALUES.filter((value) => compareLevels(value, level) < 0)

  return easier.length > 0 ? (easier[easier.length - 1] as Level) : null
}
