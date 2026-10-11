import { describe, expect, it } from 'vitest'

import { issuePlaybackToken, verifyPlaybackToken } from './playback-token'

const SECRET = 'test-secret-not-shorter-than-thirty-two-characters'
const NOW = new Date('2026-08-10T12:00:00Z')

function issue(userId = 'user-1', videoId = 'video-1', ttl = 3600): string {
  return issuePlaybackToken({ userId, videoId }, SECRET, ttl, NOW)
}

describe('issuePlaybackToken', () => {
  it('выдаёт ключ, который сам же и проверяет', () => {
    const claims = verifyPlaybackToken(issue(), SECRET, NOW)

    expect(claims?.userId).toBe('user-1')
    expect(claims?.videoId).toBe('video-1')
  })

  it('кладёт в ключ срок действия', () => {
    const claims = verifyPlaybackToken(issue('user-1', 'video-1', 900), SECRET, NOW)

    expect(claims?.expiresAt).toEqual(new Date('2026-08-10T12:15:00Z'))
  })

  it('разным людям выдаёт разные ключи', () => {
    expect(issue('user-1')).not.toBe(issue('user-2'))
  })

  it('на разные ролики выдаёт разные ключи', () => {
    // Ключ, подсмотренный на бесплатном ролике, не должен открывать платный
    expect(issue('user-1', 'video-1')).not.toBe(issue('user-1', 'video-2'))
  })
})

describe('verifyPlaybackToken', () => {
  it('отвергает ключ с подменённой полезной нагрузкой', () => {
    const token = issue('user-1', 'video-1')
    const forged = Buffer.from(JSON.stringify({ u: 'user-2', v: 'video-1', e: 99999999999 }))
      .toString('base64url')
      .concat(token.slice(token.lastIndexOf('.')))

    expect(verifyPlaybackToken(forged, SECRET, NOW)).toBeNull()
  })

  it('отвергает ключ, подписанный чужим секретом', () => {
    const token = issuePlaybackToken({ userId: 'user-1', videoId: 'video-1' }, 'другой', 3600, NOW)

    expect(verifyPlaybackToken(token, SECRET, NOW)).toBeNull()
  })

  it('отвергает истёкший ключ', () => {
    const token = issue('user-1', 'video-1', 60)
    const later = new Date(NOW.getTime() + 61_000)

    expect(verifyPlaybackToken(token, SECRET, later)).toBeNull()
  })

  it('принимает ключ до последней секунды', () => {
    const token = issue('user-1', 'video-1', 60)
    const almost = new Date(NOW.getTime() + 59_000)

    expect(verifyPlaybackToken(token, SECRET, almost)).not.toBeNull()
  })

  it('не падает на мусоре вместо ключа', () => {
    for (const garbage of ['', '.', 'abc', 'a.b', '....', 'не-ключ-вовсе']) {
      expect(verifyPlaybackToken(garbage, SECRET, NOW)).toBeNull()
    }
  })

  it('не падает, если внутри ключа не JSON', () => {
    const encoded = Buffer.from('это не json', 'utf8').toString('base64url')
    const token = issue()
    const forged = `${encoded}${token.slice(token.lastIndexOf('.'))}`

    expect(verifyPlaybackToken(forged, SECRET, NOW)).toBeNull()
  })

  it('требует секрет', () => {
    expect(() => issuePlaybackToken({ userId: 'u', videoId: 'v' }, '', 60, NOW)).toThrow()
  })
})
