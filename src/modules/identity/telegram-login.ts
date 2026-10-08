import 'server-only'

import { syncAccessFromKnownMembership } from '@/modules/subscription'
import { errors } from '@/shared/errors'
import { getLogger } from '@/shared/logger'
import type { TelegramAuthData } from '@/shared/telegram'

import {
  createUserWithTelegramIdentity,
  findUserByTelegramId,
  updateTelegramIdentityData,
} from './repository'
import { startSession } from './service'
import { identityStrings } from './strings'
import { displayNameFromTelegram, providerDataFromTelegram } from './telegram-profile'

import type { RequestOrigin, SessionUser } from './types'

/**
 * Вход через виджет Telegram.
 *
 * ⚠️ ВЫКЛЮЧЕН ПО УМОЛЧАНИЮ (ADR-0030). Основной вход — по коду на почту
 * (`email-login.ts`): виджет работает, только если сайт Telegram
 * открывается в браузере участника. Код сохранён, чтобы вернуть кнопку
 * переключателем TELEGRAM_LOGIN_ENABLED, если блокировки снимут.
 *
 * Сюда попадают уже проверенные данные: подпись сверяется раньше,
 * в обработчике адреса. Этот файл отвечает только за то, что делать
 * с человеком, чья подлинность уже доказана.
 *
 * Два случая:
 *   1. Такой человек уже есть → открываем сессию
 *   2. Человека нет           → создаём участника и открываем сессию
 *
 * Роль владельца здесь не выдаётся: владелец определяется по почте
 * (`owner-bootstrap.ts`).
 */

export type TelegramSignInResult = {
  user: SessionUser
  token: string
  expiresAt: Date
  /** Впервые ли этот человек вошёл на платформу: нужно для перехода к знакомству */
  isNewUser: boolean
}

export async function signInWithTelegram(
  data: TelegramAuthData,
  origin: RequestOrigin,
): Promise<TelegramSignInResult> {
  const log = getLogger()
  const telegramId = String(data.id)

  const existing = await findUserByTelegramId(telegramId)
  const isNewUser = existing === null

  /*
   * Заблокированному вход закрыт.
   *
   * Проверка стоит до создания сессии и до синхронизации подписки:
   * иначе человек получил бы рабочую сессию, которую тут же отвергнет
   * `resolveSession`, — и увидел бы вместо объяснения бесконечный
   * круг «вход → выброс на страницу входа».
   */
  if (existing?.isBlocked) {
    log.warn({ userId: existing.userId }, 'вход заблокированного участника отклонён')
    throw errors.forbidden(identityStrings.errors.blocked)
  }

  const identity =
    existing ??
    (await createUserWithTelegramIdentity({
      telegramId,
      displayName: displayNameFromTelegram(data),
      providerData: providerDataFromTelegram(data),
    }))

  if (isNewUser) {
    log.info({ userId: identity.userId }, 'создан новый участник')
  } else {
    // Имя на платформе не трогается: человек мог поменять его у нас
    // осознанно. Фотография из Telegram не подставляется вовсе — её
    // участник загружает сам (см. TelegramProfile в repository.ts)
    await updateTelegramIdentityData(telegramId, providerDataFromTelegram(data))
  }

  /**
   * Доступ восстанавливается по фактам, накопленным до появления аккаунта.
   *
   * Человек мог оплатить подписку неделю назад: Tribute добавил его в канал,
   * Telegram прислал нам событие, но платформу он открыл только сейчас.
   * Без этого вызова он увидел бы «подписки нет», хотя деньги заплачены, —
   * и написал бы в поддержку в первую же минуту знакомства с платформой.
   */
  await syncAccessFromKnownMembership(identity.userId, telegramId)

  const { token, expiresAt } = await startSession(identity.userId, origin)

  return { user: identity.user, token, expiresAt, isNewUser }
}
