import { describe, expect, it } from 'vitest'

import type { TelegramChatMemberStatus, TelegramUpdate } from '@/shared/telegram/types'

import { interpretUpdate, isWebhookSecretValid } from './webhook'

const CHANNEL = '-1001234567890'
const OTHER_CHAT = '-1009999999999'

function chatMemberUpdate(options: {
  chatId?: string
  status: TelegramChatMemberStatus
  isMember?: boolean
  userId?: number
  isBot?: boolean
  date?: number
}): TelegramUpdate {
  return {
    update_id: 1,
    chat_member: {
      chat: { id: Number(options.chatId ?? CHANNEL), type: 'channel' },
      from: { id: 1, first_name: 'Tribute' },
      date: options.date ?? 1_700_000_000,
      old_chat_member: { status: 'left', user: { id: 42, first_name: 'Иван' } },
      new_chat_member: {
        status: options.status,
        ...(options.isMember === undefined ? {} : { is_member: options.isMember }),
        user: {
          id: options.userId ?? 42,
          first_name: 'Иван',
          ...(options.isBot === undefined ? {} : { is_bot: options.isBot }),
        },
      },
    },
  }
}

describe('уведомление о составе канала', () => {
  it('вход в канал означает членство', () => {
    const verdict = interpretUpdate(chatMemberUpdate({ status: 'member' }), CHANNEL)

    expect(verdict).toMatchObject({ kind: 'membership', telegramId: '42', isMember: true })
  })

  it('выход из канала означает потерю членства', () => {
    const verdict = interpretUpdate(chatMemberUpdate({ status: 'left' }), CHANNEL)

    expect(verdict).toMatchObject({ kind: 'membership', isMember: false })
  })

  it('удаление администратором означает потерю членства', () => {
    const verdict = interpretUpdate(chatMemberUpdate({ status: 'kicked' }), CHANNEL)

    expect(verdict).toMatchObject({ kind: 'membership', isMember: false })
  })

  it('ограниченный в правах остаётся участником, пока сказано обратное', () => {
    const stays = interpretUpdate(
      chatMemberUpdate({ status: 'restricted', isMember: true }),
      CHANNEL,
    )
    const leaves = interpretUpdate(
      chatMemberUpdate({ status: 'restricted', isMember: false }),
      CHANNEL,
    )

    expect(stays).toMatchObject({ isMember: true })
    expect(leaves).toMatchObject({ isMember: false })
  })

  it('администратор канала — тоже участник', () => {
    expect(interpretUpdate(chatMemberUpdate({ status: 'administrator' }), CHANNEL)).toMatchObject({
      isMember: true,
    })
  })

  it('события другого чата не трогают подписку', () => {
    const verdict = interpretUpdate(
      chatMemberUpdate({ chatId: OTHER_CHAT, status: 'left' }),
      CHANNEL,
    )

    expect(verdict.kind).toBe('ignored')
  })

  it('без настроенного канала обрабатывать нечего', () => {
    expect(interpretUpdate(chatMemberUpdate({ status: 'member' }), null).kind).toBe('ignored')
  })

  it('вход бота в канал подпиской не является', () => {
    const verdict = interpretUpdate(chatMemberUpdate({ status: 'member', isBot: true }), CHANNEL)

    expect(verdict.kind).toBe('ignored')
  })

  it('время события переводится из секунд', () => {
    const verdict = interpretUpdate(
      chatMemberUpdate({ status: 'member', date: 1_700_000_000 }),
      CHANNEL,
    )

    expect(verdict.kind === 'membership' && verdict.occurredAt.getUTCFullYear()).toBe(2023)
  })

  it('идентификатор Telegram приводится к строке: числа не влезают в int', () => {
    const verdict = interpretUpdate(
      chatMemberUpdate({ status: 'member', userId: 7_123_456_789 }),
      CHANNEL,
    )

    expect(verdict).toMatchObject({ telegramId: '7123456789' })
  })

  it('сообщение боту событием о составе не считается', () => {
    const update: TelegramUpdate = {
      update_id: 2,
      message: { message_id: 1, chat: { id: 1, type: 'private' }, date: 1, text: 'привет' },
    }

    expect(interpretUpdate(update, CHANNEL).kind).toBe('ignored')
  })
})

describe('изменение прав самого бота', () => {
  function botUpdate(status: TelegramChatMemberStatus, chatId = CHANNEL): TelegramUpdate {
    return {
      update_id: 3,
      my_chat_member: {
        chat: { id: Number(chatId), type: 'channel' },
        from: { id: 1, first_name: 'Админ' },
        date: 1_700_000_000,
        old_chat_member: { status: 'administrator', user: { id: 99, first_name: 'Бот' } },
        new_chat_member: { status, user: { id: 99, first_name: 'Бот', is_bot: true } },
      },
    }
  }

  it('бот остался администратором', () => {
    expect(interpretUpdate(botUpdate('administrator'), CHANNEL)).toMatchObject({
      kind: 'bot_status',
      isAdmin: true,
    })
  })

  it('бота лишили администратора — уведомления перестанут приходить', () => {
    expect(interpretUpdate(botUpdate('member'), CHANNEL)).toMatchObject({
      kind: 'bot_status',
      isAdmin: false,
    })
  })

  it('бота выгнали из канала', () => {
    expect(interpretUpdate(botUpdate('kicked'), CHANNEL)).toMatchObject({ isAdmin: false })
  })

  it('права бота в другом чате не важны', () => {
    expect(interpretUpdate(botUpdate('member', OTHER_CHAT), CHANNEL).kind).toBe('ignored')
  })
})

describe('секрет вебхука', () => {
  it('совпадающий секрет принимается', () => {
    expect(isWebhookSecretValid('s3cret', 's3cret')).toBe(true)
  })

  it('несовпадающий отвергается', () => {
    expect(isWebhookSecretValid('s3cret', 'other!')).toBe(false)
  })

  it('другая длина отвергается', () => {
    expect(isWebhookSecretValid('s3', 's3cret')).toBe(false)
  })

  it('без секрета в настройках вебхук не принимается вовсе', () => {
    expect(isWebhookSecretValid('s3cret', null)).toBe(false)
    expect(isWebhookSecretValid('s3cret', '')).toBe(false)
  })

  it('пустой заголовок отвергается', () => {
    expect(isWebhookSecretValid(null, 's3cret')).toBe(false)
    expect(isWebhookSecretValid('', 's3cret')).toBe(false)
  })
})
