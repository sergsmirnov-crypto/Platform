import { describe, expect, it } from 'vitest'

import {
  isPinnedNow,
  isValidDiscussionUrl,
  parseNewsKind,
  pinDayFromDeadline,
  pinDeadlineFromDay,
} from './rules'

const NOW = new Date('2026-12-05T12:00:00Z')

describe('isPinnedNow', () => {
  it('держит закреплённым без срока, пока не снимут', () => {
    expect(isPinnedNow(true, null, NOW)).toBe(true)
  })

  it('держит закреплённым до указанного момента', () => {
    expect(isPinnedNow(true, new Date('2026-12-06T00:00:00Z'), NOW)).toBe(true)
  })

  it('снимает закрепление, когда срок вышел', () => {
    expect(isPinnedNow(true, new Date('2026-12-05T11:59:59Z'), NOW)).toBe(false)
  })

  it('не закрепляет то, что не закреплено, даже со сроком', () => {
    expect(isPinnedNow(false, new Date('2027-01-01T00:00:00Z'), NOW)).toBe(false)
  })
})

describe('isValidDiscussionUrl', () => {
  it.each([
    'https://t.me/guitarclub/123',
    'https://t.me/c/1234567890/42/1001',
    'https://t.me/guitarclub',
  ])('принимает ссылку на Telegram: %s', (url) => {
    expect(isValidDiscussionUrl(url)).toBe(true)
  })

  it.each([
    'http://t.me/guitarclub/1',
    'https://t.me/',
    'https://t.me.evil.example/x',
    'https://example.com/t.me/x',
    'javascript:alert(1)',
    't.me/guitarclub/1',
    '',
  ])('отклоняет всё остальное: %s', (url) => {
    expect(isValidDiscussionUrl(url)).toBe(false)
  })
})

describe('parseNewsKind', () => {
  it('узнаёт виды постов', () => {
    expect(parseNewsKind('digest')).toBe('digest')
    expect(parseNewsKind('greeting')).toBe('greeting')
  })

  it.each(['', 'всё', undefined, ['digest']])('не принимает чужое: %s', (value) => {
    expect(parseNewsKind(value)).toBeNull()
  })
})

describe('pinDeadlineFromDay / pinDayFromDeadline', () => {
  it('закрепляет до конца выбранного дня по Москве', () => {
    expect(pinDeadlineFromDay('2026-12-12')?.toISOString()).toBe('2026-12-12T20:59:59.000Z')
  })

  it('пустое или испорченное поле — без срока', () => {
    expect(pinDeadlineFromDay('')).toBeNull()
    expect(pinDeadlineFromDay(null)).toBeNull()
    expect(pinDeadlineFromDay('12.12.2026')).toBeNull()
  })

  it('возвращает тот же день в поле редактора', () => {
    const deadline = pinDeadlineFromDay('2026-12-12')

    expect(pinDayFromDeadline(deadline)).toBe('2026-12-12')
    expect(pinDayFromDeadline(null)).toBe('')
  })
})
