import 'server-only'

import { appConfig } from '@/shared/config'
import { serverEnv } from '@/shared/config/env.server'
import { requireSessionSecret } from '@/shared/config/secrets'
import { isUniqueViolation } from '@/shared/db'
import { getLogger } from '@/shared/logger'
import { generateToken, hashWithSecret } from '@/shared/security/hashing'
import type { TelegramUser } from '@/shared/telegram'

import { findTelegramIdByUserId, findUserByTelegramId } from './repository'
import { decideLink } from './telegram-link-policy'
import {
  attachTelegramIdentity,
  findLinkToken,
  insertLinkToken,
  markLinkTokenUsed,
} from './telegram-link-repository'
import {
  DEFAULT_DISPLAY_NAME,
  displayNameFromTelegram,
  providerDataFromTelegram,
} from './telegram-profile'

import type { LinkOutcome } from './telegram-link-policy'

/**
 * Подключение Telegram к аккаунту платформы.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗАЧЕМ ВООБЩЕ TELEGRAM, ЕСЛИ ВХОД ПО ПОЧТЕ
 *
 * Подписку оформляет Tribute, а он живёт в Telegram: оплатил — попал
 * в закрытый канал. О членстве в канале Telegram сообщает нам по
 * идентификатору Telegram, а не по почте. Значит, один раз нужно
 * узнать, какой Telegram у человека, — дальше подписка обновляется
 * сама (ADR-0030).
 *
 * Подключение идёт через приложение Telegram, а не через сайт telegram.org:
 * приложение у участника работает — через него он и оплачивал. Сайт
 * в браузере может быть недоступен, приложение — нет.
 * ─────────────────────────────────────────────────────────────────
 */

/** Длина ключа в байтах: 24 байта дают 32 символа, в пределах 64, разрешённых Telegram */
const LINK_TOKEN_BYTES = 24

function hashLinkToken(token: string): string {
  return hashWithSecret(`telegram-link:${token}`, requireSessionSecret())
}

/** Можно ли сейчас подключать Telegram: без бота ссылку не на что вести */
export function isTelegramLinkAvailable(): boolean {
  return Boolean(serverEnv.TELEGRAM_BOT_USERNAME && serverEnv.TELEGRAM_BOT_TOKEN)
}

export type TelegramLink = {
  /** Обычная ссылка: открывает приложение Telegram, если оно установлено */
  url: string
  /**
   * Прямая ссылка в приложение, минуя сайт t.me.
   * Запасной путь на случай, когда сайт t.me в браузере не открывается
   */
  appUrl: string
}

/**
 * Выдаёт ссылку на бота с одноразовым ключом.
 *
 * Прежние ключи не гасятся: человек мог открыть страницу в двух вкладках
 * и нажать ссылку из первой. Ключи дёшевы и живут пятнадцать минут.
 */
export async function createTelegramLink(userId: string): Promise<TelegramLink> {
  const bot = serverEnv.TELEGRAM_BOT_USERNAME

  if (!bot) {
    throw new Error('Подключение Telegram недоступно: не задан TELEGRAM_BOT_USERNAME')
  }

  const token = generateToken(LINK_TOKEN_BYTES)
  const expiresAt = new Date(Date.now() + appConfig.auth.telegramLinkLifetimeMinutes * 60 * 1000)

  await insertLinkToken({ userId, tokenHash: hashLinkToken(token), expiresAt })

  return {
    url: `https://t.me/${bot}?start=${token}`,
    appUrl: `tg://resolve?domain=${bot}&start=${token}`,
  }
}

/**
 * Привязывает Telegram того, кто нажал «Старт», к аккаунту из ключа.
 *
 * Проверка подписки сюда не входит: это работа модуля подписок, и её
 * вызывает обработчик уведомлений, получив результат `linked`.
 */
export async function linkTelegramByToken(token: string, from: TelegramUser): Promise<LinkOutcome> {
  const log = getLogger()
  const stored = await findLinkToken(hashLinkToken(token))
  if (!stored) return { kind: 'expired' }

  const telegramId = String(from.id)
  const [owner, current] = await Promise.all([
    findUserByTelegramId(telegramId),
    findTelegramIdByUserId(stored.userId),
  ])

  /*
   * Повторное нажатие «Старт» по той же ссылке. Ключ уже использован,
   * но отвечать «ссылка устарела» человеку, у которого всё подключено,
   * значит напугать его на ровном месте
   */
  if (owner?.userId === stored.userId) {
    return { kind: 'already_linked', userId: stored.userId, telegramId }
  }

  if (stored.usedAt || stored.expiresAt <= new Date()) {
    return { kind: 'expired' }
  }

  const decision = decideLink({
    userId: stored.userId,
    telegramId,
    ownerOfTelegram: owner?.userId ?? null,
    telegramOfAccount: current,
  })

  if (decision.kind !== 'attach') {
    if (decision.kind !== 'already_linked') {
      log.warn({ userId: stored.userId, outcome: decision.kind }, 'подключение Telegram отклонено')
    }
    return decision
  }

  if (!(await markLinkTokenUsed(stored.id))) {
    // Тот же «Старт» обрабатывается параллельно — второй раз не привязываем
    return { kind: 'expired' }
  }

  try {
    await attachTelegramIdentity({
      userId: stored.userId,
      telegramId,
      providerData: providerDataFromTelegram(from),
      displayName: displayNameFromTelegram(from),
      placeholderName: DEFAULT_DISPLAY_NAME,
    })
  } catch (error) {
    if (!isUniqueViolation(error)) throw error

    // Уникальность в базе сработала раньше нашей проверки: кто-то
    // успел привязать этот Telegram или этот аккаунт в ту же секунду
    log.warn({ userId: stored.userId }, 'гонка при подключении Telegram')
    return { kind: 'taken_by_other' }
  }

  log.info({ userId: stored.userId }, 'Telegram подключён к аккаунту')

  return { kind: 'linked', userId: stored.userId, telegramId }
}
