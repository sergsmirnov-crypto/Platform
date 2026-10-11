import { describe, expect, it } from 'vitest'

import { describeDevice, lastSeenLabel } from './devices'

/**
 * Тесты подписей устройств.
 *
 * Главное здесь — порядок проверок. Почти каждый браузер представляется
 * ещё и Chrome, а Chrome вдобавок Safari: перепутанный порядок назвал бы
 * все устройства одинаково, и экран «активные устройства» перестал бы
 * отвечать на свой единственный вопрос — «это я или не я».
 */

const AGENTS = {
  chromeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  safariMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  yandex:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 YaBrowser/24.10.0.0 Safari/537.36',
  firefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/604.1',
} as const

describe('describeDevice', () => {
  it('узнаёт Chrome на Windows', () => {
    expect(describeDevice(AGENTS.chromeWindows)).toMatchObject({
      browser: 'Chrome',
      platform: 'Windows',
      kind: 'desktop',
    })
  })

  it('не путает Safari с Chrome: Chrome представляется и тем и другим', () => {
    expect(describeDevice(AGENTS.safariMac).browser).toBe('Safari')
    expect(describeDevice(AGENTS.chromeWindows).browser).toBe('Chrome')
  })

  it('не называет Edge хромом', () => {
    expect(describeDevice(AGENTS.edge).browser).toBe('Edge')
  })

  it('узнаёт Яндекс.Браузер, хотя он тоже представляется хромом', () => {
    expect(describeDevice(AGENTS.yandex).browser).toBe('Яндекс.Браузер')
  })

  it('узнаёт Firefox', () => {
    expect(describeDevice(AGENTS.firefox)).toMatchObject({ browser: 'Firefox', platform: 'Linux' })
  })

  it('отличает телефон от компьютера', () => {
    expect(describeDevice(AGENTS.safariIphone).kind).toBe('mobile')
    expect(describeDevice(AGENTS.chromeAndroid).kind).toBe('mobile')
    expect(describeDevice(AGENTS.safariMac).kind).toBe('desktop')
  })

  it('отличает планшет от телефона', () => {
    expect(describeDevice(AGENTS.ipad).kind).toBe('tablet')
  })

  it('собирает подпись из браузера и системы', () => {
    expect(describeDevice(AGENTS.chromeAndroid).label).toBe('Chrome · Android')
  })

  it.each([[null], [undefined], [''], ['   '], ['совершенно посторонняя строка']])(
    'не выдумывает устройство из %p',
    (value) => {
      expect(describeDevice(value).kind).toBe('unknown')
      expect(describeDevice(value).label).toBe('Неизвестное устройство')
    },
  )
})

describe('lastSeenLabel', () => {
  const now = new Date('2026-08-09T12:00:00Z')

  const cases: [string, string, string][] = [
    ['только что', '2026-08-09T11:59:30Z', 'сейчас'],
    ['минуты', '2026-08-09T11:20:00Z', '40 мин. назад'],
    ['часы', '2026-08-09T07:00:00Z', '5 ч. назад'],
    ['вчера', '2026-08-08T10:00:00Z', 'вчера'],
    ['дни', '2026-08-06T10:00:00Z', '3 дн. назад'],
  ]

  it.each(cases)('%s', (_name, iso, expected) => {
    expect(lastSeenLabel(new Date(iso), now)).toBe(expected)
  })

  it('для давних входов показывает дату', () => {
    expect(lastSeenLabel(new Date('2026-06-01T10:00:00Z'), now)).toContain('июня')
  })
})
