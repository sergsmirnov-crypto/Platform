/**
 * Как назвать устройство в списке активных сессий.
 *
 * Строка, которой представляется браузер, человеку не показывается:
 * «Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36…»
 * не помогает ответить на единственный вопрос, ради которого экран
 * существует, — «это я или не я».
 *
 * Точность здесь не нужна и недостижима: браузеры представляются друг
 * другом со времён, когда сайты проверяли «поддерживается ли Netscape».
 * Достаточно, чтобы человек узнал свой телефон и не узнал чужой ноутбук.
 *
 * Чистые функции, поэтому покрыты тестами. Порядок проверок в них
 * и есть главное: почти каждый браузер представляется ещё и Chrome,
 * а Chrome вдобавок — Safari.
 */

export type DeviceKind = 'desktop' | 'mobile' | 'tablet' | 'unknown'

export type DeviceDescription = {
  /** Готовая подпись: «Chrome · Windows» */
  label: string
  browser: string | null
  platform: string | null
  kind: DeviceKind
}

const UNKNOWN: DeviceDescription = {
  label: 'Неизвестное устройство',
  browser: null,
  platform: null,
  kind: 'unknown',
}

/**
 * Порядок важен и менять его нельзя без причины.
 *
 * Edge, Opera и Яндекс.Браузер содержат в своей строке слово Chrome,
 * а Chrome содержит Safari. Проверка «сверху вниз» — единственный
 * способ не назвать их всех одинаково.
 */
const BROWSERS: { marker: RegExp; name: string }[] = [
  { marker: /YaBrowser/i, name: 'Яндекс.Браузер' },
  { marker: /Edg[ecA]?\//i, name: 'Edge' },
  { marker: /OPR\/|Opera/i, name: 'Opera' },
  { marker: /Firefox\/|FxiOS/i, name: 'Firefox' },
  { marker: /Chrome\/|CriOS/i, name: 'Chrome' },
  { marker: /Safari\//i, name: 'Safari' },
]

const PLATFORMS: { marker: RegExp; name: string }[] = [
  { marker: /iPhone/i, name: 'iPhone' },
  { marker: /iPad/i, name: 'iPad' },
  { marker: /Android/i, name: 'Android' },
  { marker: /Windows/i, name: 'Windows' },
  { marker: /Mac OS X|Macintosh/i, name: 'macOS' },
  { marker: /Linux/i, name: 'Linux' },
]

function kindOf(userAgent: string): DeviceKind {
  if (/iPad|Tablet/i.test(userAgent)) return 'tablet'
  if (/Mobi|iPhone|Android/i.test(userAgent)) return 'mobile'

  return 'desktop'
}

export function describeDevice(userAgent: string | null | undefined): DeviceDescription {
  if (!userAgent || userAgent.trim() === '') return UNKNOWN

  const browser = BROWSERS.find((item) => item.marker.test(userAgent))?.name ?? null
  const platform = PLATFORMS.find((item) => item.marker.test(userAgent))?.name ?? null

  if (!browser && !platform) return UNKNOWN

  return {
    label: [browser, platform].filter(Boolean).join(' · '),
    browser,
    platform,
    kind: kindOf(userAgent),
  }
}

/**
 * Когда устройство было активно, словами.
 *
 * «Сегодня» и «вчера» вместо даты не украшение: человек ищет глазами
 * чужой вход, а чужой вход — это почти всегда «сегодня» или «вчера».
 * Точная дата нужна только для давних сессий.
 */
export function lastSeenLabel(lastUsedAt: Date, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - lastUsedAt.getTime()) / 60_000)

  if (minutes < 2) return 'сейчас'
  if (minutes < 60) return `${minutes} мин. назад`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ч. назад`

  const days = Math.floor(hours / 24)
  if (days === 1) return 'вчера'
  if (days < 7) return `${days} дн. назад`

  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(lastUsedAt)
}
