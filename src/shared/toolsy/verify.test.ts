import { describe, expect, it } from 'vitest'

import { signToolsyPayloadForTesting, verifyToolsySignature } from './verify'

/**
 * Подпись — единственное, что отличает Toolsy от того, кто решил подарить
 * себе подписку поддельным уведомлением. Каждый способ обмана закрыт
 * отдельной проверкой.
 */

const SECRET = 'whsec_test_do_not_use_in_production'
const TIMESTAMP = 1_700_000_000
const BODY = JSON.stringify({ id: 'arq_1', type: 'subscription.created', data: { id: 'sub_1' } })

describe('verifyToolsySignature', () => {
  it('принимает уведомление с верной подписью', () => {
    const header = signToolsyPayloadForTesting(TIMESTAMP, BODY, SECRET)

    expect(verifyToolsySignature(header, BODY, SECRET)).toBe(true)
  })

  it('совпадает с примером из документации Toolsy: HMAC-SHA256 от «время.тело»', async () => {
    const { createHmac } = await import('node:crypto')
    const hmac = createHmac('sha256', SECRET).update(`${TIMESTAMP}.${BODY}`, 'utf8').digest('hex')

    expect(verifyToolsySignature(`t=${TIMESTAMP},v1=${hmac}`, BODY, SECRET)).toBe(true)
  })

  it('отклоняет изменённое тело', () => {
    const header = signToolsyPayloadForTesting(TIMESTAMP, BODY, SECRET)
    const forged = BODY.replace('subscription.created', 'subscription.updated')

    expect(verifyToolsySignature(header, forged, SECRET)).toBe(false)
  })

  it('отклоняет тело, пересобранное после разбора JSON', () => {
    const pretty = JSON.stringify(JSON.parse(BODY), null, 2)
    const header = signToolsyPayloadForTesting(TIMESTAMP, pretty, SECRET)

    // Подпись считается по байтам, а не по смыслу
    expect(verifyToolsySignature(header, BODY, SECRET)).toBe(false)
  })

  it('отклоняет подмену времени', () => {
    const header = signToolsyPayloadForTesting(TIMESTAMP, BODY, SECRET)

    expect(verifyToolsySignature(header.replace(`t=${TIMESTAMP}`, 't=1'), BODY, SECRET)).toBe(false)
  })

  it('отклоняет подпись чужим ключом', () => {
    const header = signToolsyPayloadForTesting(TIMESTAMP, BODY, 'другой-ключ')

    expect(verifyToolsySignature(header, BODY, SECRET)).toBe(false)
  })

  it.each([
    ['пустой заголовок', ''],
    ['нет заголовка', null],
    ['без времени', 'v1=' + 'a'.repeat(64)],
    ['короткая подпись', `t=${TIMESTAMP},v1=abc`],
    ['не шестнадцатеричная подпись', `t=${TIMESTAMP},v1=${'z'.repeat(64)}`],
  ])('отклоняет испорченный заголовок: %s', (_name, header) => {
    expect(verifyToolsySignature(header, BODY, SECRET)).toBe(false)
  })

  it('отклоняет всё, если секрет не задан', () => {
    const header = signToolsyPayloadForTesting(TIMESTAMP, BODY, '')

    expect(verifyToolsySignature(header, BODY, '')).toBe(false)
    expect(verifyToolsySignature(header, BODY, undefined)).toBe(false)
  })
})
