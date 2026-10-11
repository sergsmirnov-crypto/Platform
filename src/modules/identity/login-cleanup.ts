import 'server-only'

import { deleteStaleCodes } from './email-login-repository'
import { deleteStaleLinkTokens } from './telegram-link-repository'

/**
 * Уборка одноразовых кодов входа и ключей подключения Telegram.
 *
 * Оба живут минуты, но остаются в базе: каждый вход оставляет строку.
 * Сутки хранения хватает, чтобы разобрать жалобу «мне не пришёл код»
 * в тот же день, и таблицы при этом остаются крошечными.
 */
const KEEP_HOURS = 24

export async function cleanupLoginArtifacts(
  now: Date = new Date(),
): Promise<{ codes: number; linkTokens: number }> {
  const before = new Date(now.getTime() - KEEP_HOURS * 60 * 60 * 1000)

  const [codes, linkTokens] = await Promise.all([
    deleteStaleCodes(before),
    deleteStaleLinkTokens(before),
  ])

  return { codes, linkTokens }
}
