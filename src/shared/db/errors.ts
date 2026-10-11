/**
 * Распознавание ошибок базы данных.
 *
 * Большинство ошибок базы — настоящие поломки, и их правильно пропустить
 * наверх. Нарушение уникальности — исключение: оно означает «такая запись
 * уже есть», и чаще всего это гонка двух одновременных запросов, а не сбой.
 * Вызывающий код обязан отличить одно от другого: показать человеку
 * «что-то пошло не так» в ответ на двойное нажатие кнопки — ошибка.
 */

/** Код нарушения уникальности в PostgreSQL */
const UNIQUE_VIOLATION = '23505'

function errorCode(error: unknown): string | undefined {
  // Драйвер кладёт код в саму ошибку, Drizzle оборачивает её и кладёт в причину
  const candidates = [error, (error as { cause?: unknown } | null)?.cause]

  for (const candidate of candidates) {
    const code = (candidate as { code?: unknown } | null)?.code
    if (typeof code === 'string') return code
  }

  return undefined
}

/** Упал ли запрос на ограничении уникальности */
export function isUniqueViolation(error: unknown): boolean {
  return errorCode(error) === UNIQUE_VIOLATION
}
