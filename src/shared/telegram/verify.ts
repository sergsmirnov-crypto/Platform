import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

import type { TelegramAuthData } from './types'

/**
 * Проверка подлинности данных, пришедших от Telegram.
 *
 * Это самое ответственное место во всём входе. Виджет Telegram возвращает
 * данные человека прямо в браузер, откуда их отправляют нам. Доверять им
 * нельзя: подделать содержимое запроса может кто угодно. Подлинность
 * доказывает подпись, вычисленная с использованием токена бота —
 * секрета, известного только Telegram и нам.
 *
 * Файл намеренно не зависит ни от настроек, ни от базы, ни от журнала:
 * только чистые функции. Токен передаётся аргументом. Благодаря этому
 * проверку можно полностью покрыть тестами, не поднимая приложение.
 *
 * Алгоритмы описаны в документации Telegram:
 * https://core.telegram.org/widgets/login (виджет)
 * https://core.telegram.org/bots/webapps  (Mini App)
 */

/**
 * Сколько секунд данные входа считаются свежими.
 *
 * Подпись Telegram сама по себе не протухает: перехваченный ответ виджета
 * можно предъявить и через месяц. Ограничение по времени — единственная
 * защита от повторного использования (replay). Пять минут с запасом
 * покрывают медленный интернет и рассинхронизацию часов.
 */
export const DEFAULT_MAX_AUTH_AGE_SECONDS = 300

/** Почему проверка не прошла. Наружу человеку эти коды не показываются. */
export type VerificationFailureReason =
  /** В данных нет подписи или обязательных полей */
  | 'malformed'
  /** Подпись не совпала: данные подделаны или токен бота не тот */
  | 'invalid_signature'
  /** Подпись верна, но данные слишком старые */
  | 'expired'

export type VerificationResult<T> =
  { ok: true; data: T } | { ok: false; reason: VerificationFailureReason }

/**
 * Собирает строку, по которой Telegram считал подпись.
 *
 * Правило одинаково для виджета и Mini App: все поля кроме `hash`,
 * отсортированные по имени, в формате `ключ=значение`, через перевод строки.
 */
function buildDataCheckString(fields: Map<string, string>): string {
  return [...fields.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
}

/**
 * Сравнение подписей за постоянное время.
 *
 * Обычное сравнение строк завершается на первом несовпавшем символе,
 * и по времени ответа можно подбирать подпись посимвольно. Здесь время
 * не зависит от содержимого.
 */
function signaturesMatch(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected, 'hex')
  const receivedBuffer = Buffer.from(received, 'hex')

  // timingSafeEqual требует одинаковой длины, иначе выбрасывает ошибку
  if (expectedBuffer.length !== receivedBuffer.length || expectedBuffer.length === 0) {
    return false
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer)
}

function isFresh(authDate: number, maxAgeSeconds: number, now: number): boolean {
  const ageSeconds = now / 1000 - authDate
  // Небольшое отрицательное значение допустимо: часы сервера и Telegram
  // могут разойтись на пару секунд. Дата из далёкого будущего — нет.
  return ageSeconds >= -60 && ageSeconds <= maxAgeSeconds
}

/** Приводит данные виджета к типизированному виду, проверяя обязательные поля */
function parseAuthData(fields: Map<string, string>): TelegramAuthData | null {
  const id = Number(fields.get('id'))
  const authDate = Number(fields.get('auth_date'))
  const firstName = fields.get('first_name')

  if (!Number.isSafeInteger(id) || id <= 0) return null
  if (!Number.isSafeInteger(authDate) || authDate <= 0) return null
  if (!firstName) return null

  return {
    id,
    first_name: firstName,
    auth_date: authDate,
    ...(fields.get('last_name') ? { last_name: fields.get('last_name')! } : {}),
    ...(fields.get('username') ? { username: fields.get('username')! } : {}),
    ...(fields.get('photo_url') ? { photo_url: fields.get('photo_url')! } : {}),
  }
}

export type VerifyOptions = {
  /** Срок свежести данных в секундах */
  maxAgeSeconds?: number
  /** Текущее время в миллисекундах. Параметр существует ради тестов */
  now?: number
}

/**
 * Проверяет данные виджета входа Telegram.
 *
 * Ключ подписи: `SHA256(токен_бота)`.
 *
 * @param fields  поля, пришедшие от виджета, включая `hash`
 * @param botToken токен бота от @BotFather
 */
export function verifyLoginWidget(
  fields: Record<string, string | undefined>,
  botToken: string,
  options: VerifyOptions = {},
): VerificationResult<TelegramAuthData> {
  const maxAge = options.maxAgeSeconds ?? DEFAULT_MAX_AUTH_AGE_SECONDS
  const now = options.now ?? Date.now()

  const receivedHash = fields.hash
  if (!receivedHash || !botToken) {
    return { ok: false, reason: 'malformed' }
  }

  const present = new Map<string, string>()
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) present.set(key, value)
  }

  const authData = parseAuthData(present)
  if (!authData) {
    return { ok: false, reason: 'malformed' }
  }

  const secretKey = createHash('sha256').update(botToken).digest()
  const expectedHash = createHmac('sha256', secretKey)
    .update(buildDataCheckString(present))
    .digest('hex')

  if (!signaturesMatch(expectedHash, receivedHash)) {
    return { ok: false, reason: 'invalid_signature' }
  }

  if (!isFresh(authData.auth_date, maxAge, now)) {
    return { ok: false, reason: 'expired' }
  }

  return { ok: true, data: authData }
}

/**
 * Проверяет `initData` из Telegram Mini App.
 *
 * Отличий от виджета два: данные приходят строкой запроса, а ключ подписи
 * считается иначе — `HMAC-SHA256(токен_бота, "WebAppData")`. Сведения
 * о человеке лежат внутри поля `user` в виде JSON.
 *
 * Нужно для сценария «открыть платформу прямо в Telegram» — сильного
 * для этой аудитории (PRD v0.1 §7.2). Проверка написана сразу, чтобы позже
 * добавление входа из мессенджера не требовало трогать безопасность.
 */
export function verifyMiniAppInitData(
  initData: string,
  botToken: string,
  options: VerifyOptions = {},
): VerificationResult<TelegramAuthData> {
  const maxAge = options.maxAgeSeconds ?? DEFAULT_MAX_AUTH_AGE_SECONDS
  const now = options.now ?? Date.now()

  if (!initData || !botToken) {
    return { ok: false, reason: 'malformed' }
  }

  const params = new URLSearchParams(initData)
  const receivedHash = params.get('hash')
  if (!receivedHash) {
    return { ok: false, reason: 'malformed' }
  }

  const fields = new Map<string, string>(params.entries())

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const expectedHash = createHmac('sha256', secretKey)
    .update(buildDataCheckString(fields))
    .digest('hex')

  if (!signaturesMatch(expectedHash, receivedHash)) {
    return { ok: false, reason: 'invalid_signature' }
  }

  // Подпись уже проверена, поэтому содержимое можно разбирать без опаски
  const authDate = Number(fields.get('auth_date'))
  const rawUser = fields.get('user')
  if (!rawUser || !Number.isSafeInteger(authDate) || authDate <= 0) {
    return { ok: false, reason: 'malformed' }
  }

  let parsedUser: unknown
  try {
    parsedUser = JSON.parse(rawUser)
  } catch {
    return { ok: false, reason: 'malformed' }
  }

  const user = parsedUser as Partial<TelegramAuthData> & { id?: number }
  if (!user || !Number.isSafeInteger(user.id) || !user.first_name) {
    return { ok: false, reason: 'malformed' }
  }

  if (!isFresh(authDate, maxAge, now)) {
    return { ok: false, reason: 'expired' }
  }

  return {
    ok: true,
    data: {
      id: user.id!,
      first_name: user.first_name,
      auth_date: authDate,
      ...(user.last_name ? { last_name: user.last_name } : {}),
      ...(user.username ? { username: user.username } : {}),
      ...(user.photo_url ? { photo_url: user.photo_url } : {}),
    },
  }
}

/**
 * Вспомогательное: подписывает данные так же, как это делает Telegram.
 *
 * Нужно только тестам и локальной отладке — чтобы собрать правдоподобный
 * ответ виджета, не обращаясь к настоящему Telegram. В рабочем коде
 * вызывать эту функцию неоткуда: мы подписи проверяем, а не создаём.
 */
export function signLoginWidgetForTesting(
  fields: Record<string, string | number>,
  botToken: string,
): Record<string, string> {
  const normalized = new Map<string, string>(
    Object.entries(fields).map(([key, value]) => [key, String(value)]),
  )

  const secretKey = createHash('sha256').update(botToken).digest()
  const hash = createHmac('sha256', secretKey)
    .update(buildDataCheckString(normalized))
    .digest('hex')

  return { ...Object.fromEntries(normalized), hash }
}
