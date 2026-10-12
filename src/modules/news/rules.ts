import { NEWS_KINDS } from './types'

import type { NewsKind } from './types'

/**
 * Правила новостей: чистые функции, без базы. Используются и сервером,
 * и редактором в браузере — проверка ссылки должна совпадать в обоих.
 */

/**
 * Закреплён ли пост прямо сейчас.
 *
 * Признак без даты — закреплён, пока не снимут. С датой — до неё:
 * анонс субботней встречи не висит первым в понедельник.
 */
export function isPinnedNow(isPinned: boolean, pinnedUntil: Date | null, now: Date): boolean {
  if (!isPinned) return false
  return pinnedUntil === null || pinnedUntil.getTime() > now.getTime()
}

/**
 * Годится ли ссылка для кнопки «Обсудить в чате».
 *
 * Только Telegram и только по защищённому адресу: кнопку видит весь клуб,
 * и ссылка из неё не должна вести на сторонний сайт, даже если куратор
 * вставил что-то по ошибке.
 */
export function isValidDiscussionUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 't.me' && url.pathname.length > 1
  } catch {
    return false
  }
}

/** Вид поста из адресной строки. Чужое значение — «все виды» */
export function parseNewsKind(value: unknown): NewsKind | null {
  return typeof value === 'string' && (NEWS_KINDS as readonly string[]).includes(value)
    ? (value as NewsKind)
    : null
}

/**
 * Срок закрепления из поля «до какого дня» — конец этого дня
 * по московскому времени.
 *
 * Куратор думает днями: «до субботы» значит «всю субботу». Смещение
 * задано числом, а не вычисляется: в Москве нет перехода на летнее
 * время с 2014 года, и часовой пояс клуба — московский (app.config).
 *
 * @returns `null` — поле пустое или испорчено: закрепить без срока
 */
export function pinDeadlineFromDay(day: string | null | undefined): Date | null {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null

  const date = new Date(`${day}T23:59:59+03:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Обратное: срок закрепления — значение поля «до какого дня» */
export function pinDayFromDeadline(deadline: Date | null): string {
  if (!deadline) return ''

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(deadline)
}
