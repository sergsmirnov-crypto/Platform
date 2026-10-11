import { describe, expect, it } from 'vitest'

import { isInChannel } from './membership'

import type { TelegramChatMember, TelegramChatMemberStatus } from './types'

const member = (
  status: TelegramChatMemberStatus,
  extra: Partial<TelegramChatMember> = {},
): TelegramChatMember => ({
  status,
  user: { id: 42, first_name: 'Иван' },
  ...extra,
})

describe('isInChannel', () => {
  it('считает участником обычного подписчика', () => {
    expect(isInChannel(member('member'))).toBe(true)
  })

  it('считает участниками владельца и администраторов канала', () => {
    expect(isInChannel(member('creator'))).toBe(true)
    expect(isInChannel(member('administrator'))).toBe(true)
  })

  it('считает вышедшего и удалённого не участниками', () => {
    expect(isInChannel(member('left'))).toBe(false)
    expect(isInChannel(member('kicked'))).toBe(false)
  })

  it('сохраняет доступ ограниченному в правах, если он остаётся в канале', () => {
    // Ограничение прав в чате не должно отбирать оплаченный доступ
    expect(isInChannel(member('restricted', { is_member: true }))).toBe(true)
  })

  it('снимает доступ с ограниченного, выведенного из канала', () => {
    expect(isInChannel(member('restricted', { is_member: false }))).toBe(false)
  })

  it('трактует restricted без признака членства как отсутствие в канале', () => {
    expect(isInChannel(member('restricted'))).toBe(false)
  })

  it('считает неизвестного Telegram человека не участником', () => {
    expect(isInChannel(null)).toBe(false)
    expect(isInChannel(undefined)).toBe(false)
  })
})
