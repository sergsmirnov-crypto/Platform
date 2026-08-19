import { createHmac } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import {
  DEFAULT_MAX_AUTH_AGE_SECONDS,
  signLoginWidgetForTesting,
  verifyLoginWidget,
  verifyMiniAppInitData,
} from './verify'

/**
 * Проверка подписи — единственное, что отделяет закрытую платформу
 * от входа под чужим именем. Поэтому тестов здесь больше, чем кода:
 * каждый способ обмана должен быть закрыт явной проверкой.
 */

const BOT_TOKEN = '123456:TEST-TOKEN-DO-NOT-USE-IN-PRODUCTION'
const NOW = 1_700_000_000_000 // фиксированное время, чтобы тесты не зависели от даты
const AUTH_DATE = Math.floor(NOW / 1000)

function validWidgetFields(overrides: Record<string, string | number> = {}) {
  return signLoginWidgetForTesting(
    {
      id: 42,
      first_name: 'Иван',
      last_name: 'Петров',
      username: 'ivan',
      photo_url: 'https://t.me/i/userpic/320/ivan.jpg',
      auth_date: AUTH_DATE,
      ...overrides,
    },
    BOT_TOKEN,
  )
}

describe('verifyLoginWidget', () => {
  it('принимает корректно подписанные данные', () => {
    const result = verifyLoginWidget(validWidgetFields(), BOT_TOKEN, { now: NOW })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.id).toBe(42)
    expect(result.data.first_name).toBe('Иван')
    expect(result.data.username).toBe('ivan')
  })

  it('отклоняет данные, изменённые после подписи', () => {
    const fields = validWidgetFields()
    // Классическая попытка: подставить чужой идентификатор, оставив подпись
    fields.id = '999'

    const result = verifyLoginWidget(fields, BOT_TOKEN, { now: NOW })

    expect(result).toEqual({ ok: false, reason: 'invalid_signature' })
  })

  it('отклоняет подпись, сделанную другим токеном бота', () => {
    const fields = signLoginWidgetForTesting(
      { id: 42, first_name: 'Иван', auth_date: AUTH_DATE },
      'чужой-токен',
    )

    const result = verifyLoginWidget(fields, BOT_TOKEN, { now: NOW })

    expect(result).toEqual({ ok: false, reason: 'invalid_signature' })
  })

  it('отклоняет данные без подписи', () => {
    const { hash: _hash, ...withoutHash } = validWidgetFields()

    const result = verifyLoginWidget(withoutHash, BOT_TOKEN, { now: NOW })

    expect(result).toEqual({ ok: false, reason: 'malformed' })
  })

  it('отклоняет подпись неверной длины, не падая с ошибкой', () => {
    const fields = validWidgetFields()
    fields.hash = 'abcd'

    const result = verifyLoginWidget(fields, BOT_TOKEN, { now: NOW })

    expect(result).toEqual({ ok: false, reason: 'invalid_signature' })
  })

  it('отклоняет устаревшие данные: защита от повторного использования', () => {
    const stale = Math.floor(NOW / 1000) - DEFAULT_MAX_AUTH_AGE_SECONDS - 1
    const fields = validWidgetFields({ auth_date: stale })

    const result = verifyLoginWidget(fields, BOT_TOKEN, { now: NOW })

    expect(result).toEqual({ ok: false, reason: 'expired' })
  })

  it('принимает данные на границе срока свежести', () => {
    const edge = Math.floor(NOW / 1000) - DEFAULT_MAX_AUTH_AGE_SECONDS + 1
    const fields = validWidgetFields({ auth_date: edge })

    expect(verifyLoginWidget(fields, BOT_TOKEN, { now: NOW }).ok).toBe(true)
  })

  it('допускает небольшое расхождение часов сервера и Telegram', () => {
    const slightlyAhead = Math.floor(NOW / 1000) + 5
    const fields = validWidgetFields({ auth_date: slightlyAhead })

    expect(verifyLoginWidget(fields, BOT_TOKEN, { now: NOW }).ok).toBe(true)
  })

  it('отклоняет дату из далёкого будущего', () => {
    const farFuture = Math.floor(NOW / 1000) + 3600
    const fields = validWidgetFields({ auth_date: farFuture })

    expect(verifyLoginWidget(fields, BOT_TOKEN, { now: NOW })).toEqual({
      ok: false,
      reason: 'expired',
    })
  })

  it('отклоняет данные без обязательных полей', () => {
    const fields = signLoginWidgetForTesting({ id: 42, auth_date: AUTH_DATE }, BOT_TOKEN)

    expect(verifyLoginWidget(fields, BOT_TOKEN, { now: NOW })).toEqual({
      ok: false,
      reason: 'malformed',
    })
  })

  it('отклоняет проверку без токена бота', () => {
    expect(verifyLoginWidget(validWidgetFields(), '', { now: NOW })).toEqual({
      ok: false,
      reason: 'malformed',
    })
  })

  it('не принимает нечисловой идентификатор', () => {
    const fields = signLoginWidgetForTesting(
      { id: 'not-a-number', first_name: 'Иван', auth_date: AUTH_DATE },
      BOT_TOKEN,
    )

    expect(verifyLoginWidget(fields, BOT_TOKEN, { now: NOW })).toEqual({
      ok: false,
      reason: 'malformed',
    })
  })

  it('не теряет необязательные поля при их отсутствии', () => {
    const fields = signLoginWidgetForTesting(
      { id: 7, first_name: 'Мария', auth_date: AUTH_DATE },
      BOT_TOKEN,
    )

    const result = verifyLoginWidget(fields, BOT_TOKEN, { now: NOW })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.username).toBeUndefined()
    expect(result.data.photo_url).toBeUndefined()
  })
})

/** Собирает initData так же, как это делает Telegram Mini App */
function signMiniAppInitData(fields: Record<string, string>, botToken: string): string {
  const dataCheckString = Object.entries(fields)
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  return new URLSearchParams({ ...fields, hash }).toString()
}

describe('verifyMiniAppInitData', () => {
  const user = JSON.stringify({ id: 42, first_name: 'Иван', username: 'ivan' })

  it('принимает корректно подписанные данные', () => {
    const initData = signMiniAppInitData(
      { user, auth_date: String(AUTH_DATE), query_id: 'AAA' },
      BOT_TOKEN,
    )

    const result = verifyMiniAppInitData(initData, BOT_TOKEN, { now: NOW })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.id).toBe(42)
    expect(result.data.username).toBe('ivan')
  })

  it('использует ключ, отличный от ключа виджета', () => {
    // Подпись по правилам виджета не должна проходить проверку Mini App:
    // это разные алгоритмы, и путать их нельзя
    const widgetStyle = signLoginWidgetForTesting({ user, auth_date: AUTH_DATE }, BOT_TOKEN)
    const initData = new URLSearchParams(widgetStyle).toString()

    expect(verifyMiniAppInitData(initData, BOT_TOKEN, { now: NOW })).toEqual({
      ok: false,
      reason: 'invalid_signature',
    })
  })

  it('отклоняет изменённые данные', () => {
    const initData = signMiniAppInitData({ user, auth_date: String(AUTH_DATE) }, BOT_TOKEN)
    const tampered = initData.replace('42', '99')

    expect(verifyMiniAppInitData(tampered, BOT_TOKEN, { now: NOW }).ok).toBe(false)
  })

  it('отклоняет устаревшие данные', () => {
    const stale = String(Math.floor(NOW / 1000) - DEFAULT_MAX_AUTH_AGE_SECONDS - 1)
    const initData = signMiniAppInitData({ user, auth_date: stale }, BOT_TOKEN)

    expect(verifyMiniAppInitData(initData, BOT_TOKEN, { now: NOW })).toEqual({
      ok: false,
      reason: 'expired',
    })
  })

  it('отклоняет данные с испорченным полем user', () => {
    const initData = signMiniAppInitData(
      { user: 'не json', auth_date: String(AUTH_DATE) },
      BOT_TOKEN,
    )

    expect(verifyMiniAppInitData(initData, BOT_TOKEN, { now: NOW })).toEqual({
      ok: false,
      reason: 'malformed',
    })
  })

  it('отклоняет пустую строку', () => {
    expect(verifyMiniAppInitData('', BOT_TOKEN, { now: NOW })).toEqual({
      ok: false,
      reason: 'malformed',
    })
  })
})
