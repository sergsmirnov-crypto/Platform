import { describe, expect, it } from 'vitest'

import {
  buildCalendarEvent,
  fromClubInputValue,
  toClubInputValue,
  formatArchiveDate,
  formatStreamDateTime,
  formatStreamDay,
  formatStreamTime,
  isSameClockAsClub,
} from './schedule'

/** Суббота, 16 августа 2025, 20:00 по Москве */
const SATURDAY_EVENING = new Date('2025-08-16T17:00:00.000Z')

describe('показ времени эфира', () => {
  it('пишет день словами — так его читают, а не вычисляют', () => {
    expect(formatStreamDay(SATURDAY_EVENING)).toBe('суббота, 16 августа')
  })

  it('показывает время в поясе клуба, а не сервера', () => {
    // Сервер может стоять где угодно, включая UTC. Время клуба —
    // продуктовая настройка, а не свойство машины
    expect(formatStreamTime(SATURDAY_EVENING)).toBe('20:00')
  })

  it('собирает строку целиком', () => {
    expect(formatStreamDateTime(SATURDAY_EVENING)).toBe('суббота, 16 августа, 20:00')
  })

  it('в архиве добавляет год, а в анонсе — нет', () => {
    expect(formatArchiveDate(SATURDAY_EVENING)).toBe('16 августа 2025 г.')
    expect(formatStreamDateTime(SATURDAY_EVENING)).not.toContain('2025')
  })

  it('считает то же время для другого пояса', () => {
    // Тот же миг в Белграде — на час раньше. Ради этих десяти человек
    // время и пишется с пометкой пояса
    expect(formatStreamTime(SATURDAY_EVENING, 'Europe/Belgrade')).toBe('19:00')
    expect(formatStreamTime(SATURDAY_EVENING, 'America/Vancouver')).toBe('10:00')
  })
})

describe('isSameClockAsClub', () => {
  it('не считает отличием разные названия одного времени', () => {
    // Иначе человеку в Крыму рядом с «20:00 МСК» дописалось бы «у вас — 20:00»
    expect(isSameClockAsClub(SATURDAY_EVENING, 'Europe/Simferopol')).toBe(true)
  })

  it('видит настоящее расхождение', () => {
    expect(isSameClockAsClub(SATURDAY_EVENING, 'Europe/Belgrade')).toBe(false)
    expect(isSameClockAsClub(SATURDAY_EVENING, 'America/New_York')).toBe(false)
  })
})

describe('buildCalendarEvent', () => {
  const event = {
    uid: 'stream-12@guitar-club',
    title: 'Разбор баррэ',
    description: 'Ведёт Иван',
    startsAt: SATURDAY_EVENING,
    url: 'https://example.test/app/streams/barre',
  }

  it('ставит начало на время эфира в общемировом счёте', () => {
    expect(buildCalendarEvent(event)).toContain('DTSTART:20250816T170000Z')
  })

  it('заканчивает эфир через плановую полтора часа', () => {
    expect(buildCalendarEvent(event)).toContain('DTEND:20250816T183000Z')
  })

  it('слушается заданной длительности', () => {
    expect(buildCalendarEvent({ ...event, durationMinutes: 60 })).toContain(
      'DTEND:20250816T180000Z',
    )
  })

  it('экранирует запятые в теме', () => {
    // Запятая в формате разделяет поля: «Барре, зажимы, боль»
    // без экранирования развалила бы файл
    const file = buildCalendarEvent({ ...event, title: 'Барре, зажимы, боль' })

    expect(file).toContain('SUMMARY:Барре\\, зажимы\\, боль')
  })

  it('переживает отсутствие описания', () => {
    expect(buildCalendarEvent({ ...event, description: null })).toContain('DESCRIPTION:')
  })

  it('разделяет строки так, как требует формат', () => {
    expect(buildCalendarEvent(event).split('\r\n')[0]).toBe('BEGIN:VCALENDAR')
    expect(buildCalendarEvent(event).endsWith('END:VCALENDAR\r\n')).toBe(true)
  })
})

describe('поле ввода времени эфира', () => {
  it('показывает московское время, а не время устройства', () => {
    expect(toClubInputValue(SATURDAY_EVENING)).toBe('2025-08-16T20:00')
  })

  it('читает введённое как московское', () => {
    // Куратор в отпуске в Черногории набирает «20:00» — эфир должен
    // встать на восемь вечера по Москве, а не по его часам
    expect(fromClubInputValue('2025-08-16T20:00')?.toISOString()).toBe('2025-08-16T17:00:00.000Z')
  })

  it('не теряет значение при двойном превращении', () => {
    const value = '2026-01-03T09:15'

    expect(toClubInputValue(fromClubInputValue(value) as Date)).toBe(value)
  })

  it('на мусоре не выдумывает дату', () => {
    expect(fromClubInputValue('')).toBeNull()
    expect(fromClubInputValue('завтра вечером')).toBeNull()
    expect(fromClubInputValue('2025-13-45T99:99')).toBeNull()
  })

  it('считает верно и для пояса с переводом часов', () => {
    // У Москвы перевода нет, но правило не должно зависеть от этого:
    // 1 июля в Берлине летнее время, смещение +2
    expect(fromClubInputValue('2025-07-01T12:00', 'Europe/Berlin')?.toISOString()).toBe(
      '2025-07-01T10:00:00.000Z',
    )
  })
})
