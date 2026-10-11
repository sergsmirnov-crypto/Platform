import { identityStrings, linkTelegramByToken } from '@/modules/identity'
import type { LinkOutcome, StartCommand } from '@/modules/identity'
import { verifyMembershipNow } from '@/modules/subscription'
import { serverEnv } from '@/shared/config/env.server'
import { getLogger } from '@/shared/logger'
import { telegram } from '@/shared/telegram/client'

/**
 * Человек нажал «Старт» в боте клуба.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗДЕСЬ ВСТРЕЧАЮТСЯ ДВА МОДУЛЯ — ПОЭТОМУ ЭТО СЛОЙ ПРИЛОЖЕНИЯ
 *
 * `identity` привязывает Telegram к аккаунту, `subscription` проверяет,
 * оплачен ли доступ. Ни один из модулей не вызывает другой: порядок
 * «сначала привязать, потом проверить» — решение этого обработчика,
 * как и в проверках доступа страниц (`app/app/_lib/guards.ts`).
 * ─────────────────────────────────────────────────────────────────
 *
 * Ответ боту отправляется всегда: человек смотрит на экран Telegram
 * и ждёт, что что-то произойдёт. Молчание бота читается как поломка.
 */

const replies = identityStrings.telegramLink.bot

function replyFor(outcome: LinkOutcome): string {
  switch (outcome.kind) {
    case 'linked':
      return replies.linked
    case 'already_linked':
      return replies.alreadyLinked
    case 'expired':
      return replies.expired
    case 'taken_by_other':
      return replies.takenByOther
    case 'account_has_other':
      return replies.accountHasOther
  }
}

/**
 * Отвечает человеку в боте.
 *
 * Неудача ответа не отменяет подключения: Telegram уже привязан,
 * а страница на сайте узнает об этом сама. Поэтому ошибка только
 * записывается, а не пробрасывается.
 */
async function reply(chatId: number, text: string): Promise<void> {
  try {
    await telegram.sendMessage(chatId, text)
  } catch (error) {
    getLogger().warn({ err: error }, 'не удалось ответить в боте после «Старт»')
  }
}

export async function handleStartCommand(command: StartCommand): Promise<void> {
  if (!command.token) {
    // Бота открыли не по ссылке с сайта: подсказываем, откуда начать
    await reply(command.chatId, replies.noToken)
    return
  }

  const outcome = await linkTelegramByToken(command.token, command.from)

  if (outcome.kind === 'linked' || outcome.kind === 'already_linked') {
    await verifyMembershipNow(outcome.userId, outcome.telegramId, serverEnv.TELEGRAM_CHANNEL_ID)
  }

  await reply(command.chatId, replyFor(outcome))
}
