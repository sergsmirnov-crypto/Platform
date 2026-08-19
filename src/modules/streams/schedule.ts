import { appConfig } from '@/shared/config/app.config'

/**
 * Время эфира: как его показать и как отдать в календарь.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ВРЕМЯ ВСЕГДА ПИШЕТСЯ С ПОЯСОМ
 *
 * В клубе десяток человек за рубежом — США, Канада, Сербия (PRD v0.2 §0).
 * Строка «эфир в 20:00» для них не значит ничего: человек в Белграде
 * придёт на час позже и решит, что его обманули, а человек в Ванкувере
 * не поймёт вовсе.
 *
 * Поэтому сервер всегда пишет время клуба с явной пометкой «МСК»,
 * а браузер, если его пояс отличается, дописывает местное. Догадываться
 * о поясе на сервере нельзя: он там один и тот же для всех.
 * ─────────────────────────────────────────────────────────────────
 *
 * Ни базы, ни сети — чистые функции. Пояс всегда приходит параметром
 * со значением по умолчанию: так те же функции считают и местное время
 * в браузере.
 */

/** Пометка часового пояса рядом со временем. Короткая — она стоит в строке */
export const CLUB_TIMEZONE_LABEL = 'МСК'

const CLUB_TIMEZONE = appConfig.timezone

/** «суббота, 16 августа» — день без времени */
export function formatStreamDay(date: Date, timeZone: string = CLUB_TIMEZONE): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

/** «20:00» — время без дня */
export function formatStreamTime(date: Date, timeZone: string = CLUB_TIMEZONE): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/**
 * «суббота, 16 августа, 20:00» — то, что читает человек.
 *
 * Год не пишется намеренно: у ближайших эфиров он лишний, а в архиве
 * год виден отдельной подписью только там, где записи старше текущего
 * года. Дата с годом в каждой строке списка читается тяжелее.
 */
export function formatStreamDateTime(date: Date, timeZone: string = CLUB_TIMEZONE): string {
  return `${formatStreamDay(date, timeZone)}, ${formatStreamTime(date, timeZone)}`
}

/** «16 августа 2025» — подпись записи в архиве */
export function formatArchiveDate(date: Date, timeZone: string = CLUB_TIMEZONE): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

/**
 * Совпадает ли пояс человека с поясом клуба.
 *
 * Сравниваем не названия поясов, а показания часов: «Europe/Belgrade»
 * и «Europe/Moscow» — разные названия, а летом 2026 разница в час
 * настоящая. Зато «Europe/Simferopol» от московского не отличается,
 * и дописывать человеку «у вас — 20:00» рядом с «20:00 МСК» было бы
 * шумом.
 */
export function isSameClockAsClub(date: Date, timeZone: string): boolean {
  return formatStreamTime(date, timeZone) === formatStreamTime(date, CLUB_TIMEZONE)
}

/**
 * Файл для календаря.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ КАЛЕНДАРЬ, А НЕ КНОПКА «НАПОМНИТЬ»
 *
 * Напоминания платформы — Этап 10: для них нужны очередь отправки,
 * настройки каналов и защита от потока сообщений. Кнопка «Напомнить»,
 * которая ничего не напоминает, хуже отсутствующей.
 *
 * Файл календаря даёт человеку то же самое сегодня и без нашего
 * участия: эфир попадает в календарь телефона вместе с напоминанием,
 * которое человек ставит себе сам. Когда появятся уведомления,
 * «Напомнить» встанет рядом, а эта кнопка останется — календарём
 * пользуются и те, кто отключил все уведомления.
 * ─────────────────────────────────────────────────────────────────
 *
 * Формат простой и старый, поэтому собирается строкой, без библиотеки:
 * зависимость ради двадцати строк текста — плохой обмен.
 */
export type CalendarEvent = {
  /** Устойчивый идентификатор: по нему календарь обновит, а не задвоит */
  uid: string
  title: string
  description: string | null
  startsAt: Date
  /** Сколько эфир длится по плану */
  durationMinutes?: number
  /** Адрес страницы эфира на платформе */
  url: string
}

export function buildCalendarEvent(event: CalendarEvent): string {
  const duration = event.durationMinutes ?? appConfig.streams.plannedDurationMinutes
  const endsAt = new Date(event.startsAt.getTime() + duration * 60 * 1000)

  // Время пишется в UTC. Так календарь на любом устройстве поставит эфир
  // на правильный час независимо от того, где сейчас человек, — а он
  // может смотреть расписание в поездке
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${escapeText(appConfig.name)}//RU`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${toUtcStamp(new Date())}`,
    `DTSTART:${toUtcStamp(event.startsAt)}`,
    `DTEND:${toUtcStamp(endsAt)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description ?? '')}`,
    `URL:${escapeText(event.url)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  // Перевод строки именно такой: часть календарей отказывается читать
  // файл с обычным переводом строки
  return `${lines.join('\r\n')}\r\n`
}

/** `20260816T170000Z` — вид отметки времени, принятый в формате */
function toUtcStamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`
}

/**
 * Экранирование значений.
 *
 * Запятая и точка с запятой в формате разделяют поля: тема эфира
 * «Барре, зажимы, боль» без экранирования развалила бы файл.
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

/**
 * Время эфира в поле формы и обратно.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЛЕ ВВОДА ВСЕГДА РАБОТАЕТ В ПОЯСЕ КЛУБА
 *
 * Обычное поле выбора даты в браузере работает в поясе устройства.
 * Куратор в отпуске в Черногории, назначающий эфир «на восемь вечера»,
 * назначил бы его на девять по Москве — и узнал бы об этом от участников.
 *
 * Поэтому поле заполняется и читается через эти две функции: куратор
 * всегда вводит московское время, а рядом с полем об этом написано.
 * ─────────────────────────────────────────────────────────────────
 */

/** Дата → «2026-08-16T20:00» в поясе клуба, как ждёт поле формы */
export function toClubInputValue(date: Date, timeZone: string = CLUB_TIMEZONE): string {
  const parts = clubParts(date, timeZone)

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

/**
 * «2026-08-16T20:00» в поясе клуба → дата.
 *
 * Смещение спрашивается у самой даты, а не берётся числом: у Москвы
 * перевода часов нет, но функция не должна ломаться, если однажды
 * клуб переедет в пояс, где он есть. Второй проход нужен для случая,
 * когда назначенное время попадает ровно на границу перевода.
 */
export function fromClubInputValue(value: string, timeZone: string = CLUB_TIMEZONE): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null

  const asUtc = Date.parse(`${value}:00Z`)
  if (Number.isNaN(asUtc)) return null

  const firstGuess = new Date(asUtc - offsetMs(new Date(asUtc), timeZone))
  const corrected = new Date(asUtc - offsetMs(firstGuess, timeZone))

  return corrected
}

/** Насколько пояс клуба опережает общемировое время в этот момент */
function offsetMs(date: Date, timeZone: string): number {
  const parts = clubParts(date, timeZone)

  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  )

  return asIfUtc - date.getTime()
}

function clubParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '00'

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    // В некоторых средах полночь приходит как «24» — приводим к «00»
    hour: get('hour') === '24' ? '00' : get('hour'),
    minute: get('minute'),
    second: get('second'),
  }
}
