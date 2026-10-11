import { describe, expect, it } from 'vitest'

import type { TelegramUpdate } from '@/shared/telegram'

import { decideLink, parseStartCommand } from './telegram-link-policy'

const TOKEN = 'AbCdEf0123456789_-AbCdEf01234567'
const person = { id: 42, first_name: 'Иван', username: 'ivan' }

function message(
  text: string | undefined,
  overrides: Record<string, unknown> = {},
): TelegramUpdate {
  return {
    update_id: 1,
    message: {
      message_id: 10,
      from: person,
      chat: { id: 42, type: 'private' },
      date: 1_790_000_000,
      ...(text === undefined ? {} : { text }),
      ...overrides,
    },
  }
}

describe('parseStartCommand', () => {
  it('достаёт ключ из «/start ключ»', () => {
    expect(parseStartCommand(message(`/start ${TOKEN}`))).toEqual({
      token: TOKEN,
      from: person,
      chatId: 42,
    })
  })

  it('понимает команду с именем бота', () => {
    expect(parseStartCommand(message(`/start@club_bot ${TOKEN}`))?.token).toBe(TOKEN)
  })

  it('«/start» без ключа — человек открыл бота сам', () => {
    expect(parseStartCommand(message('/start'))).toEqual({ token: null, from: person, chatId: 42 })
  })

  it('ключ неподходящего вида считается отсутствующим', () => {
    expect(parseStartCommand(message('/start короткий'))?.token).toBeNull()
    expect(parseStartCommand(message('/start abc'))?.token).toBeNull()
  })

  it('обычные сообщения боту — не команда', () => {
    expect(parseStartCommand(message('привет'))).toBeNull()
    expect(parseStartCommand(message('/help'))).toBeNull()
    expect(parseStartCommand(message(undefined))).toBeNull()
  })

  it('не принимает ключ из общего чата: там его видят все', () => {
    const update = message(`/start ${TOKEN}`, { chat: { id: -100, type: 'supergroup' } })

    expect(parseStartCommand(update)).toBeNull()
  })

  it('не принимает команду от другого бота', () => {
    const update = message(`/start ${TOKEN}`, { from: { ...person, is_bot: true } })

    expect(parseStartCommand(update)).toBeNull()
  })

  it('уведомления о составе канала — не команда', () => {
    expect(parseStartCommand({ update_id: 2 })).toBeNull()
  })
})

describe('decideLink', () => {
  const base = { userId: 'user-1', telegramId: '42' }

  it('свободный Telegram к аккаунту без Telegram — привязать', () => {
    expect(decideLink({ ...base, ownerOfTelegram: null, telegramOfAccount: null })).toEqual({
      kind: 'attach',
    })
  })

  it('повторный «Старт» того же человека — уже привязано, без ошибки', () => {
    expect(decideLink({ ...base, ownerOfTelegram: 'user-1', telegramOfAccount: '42' })).toEqual({
      kind: 'already_linked',
      userId: 'user-1',
      telegramId: '42',
    })
  })

  it('Telegram чужого аккаунта не переносится молча', () => {
    expect(decideLink({ ...base, ownerOfTelegram: 'user-2', telegramOfAccount: null })).toEqual({
      kind: 'taken_by_other',
    })
  })

  it('второй Telegram к одному аккаунту не привязывается', () => {
    expect(decideLink({ ...base, ownerOfTelegram: null, telegramOfAccount: '77' })).toEqual({
      kind: 'account_has_other',
    })
  })
})
