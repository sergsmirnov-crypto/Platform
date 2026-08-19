import 'server-only'

import { grantRoleByCode, hasAnyRole, OWNER_ROLE_CODE } from '@/modules/access'
import { syncAccessFromKnownMembership } from '@/modules/subscription'
import { serverEnv } from '@/shared/config/env.server'
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

import type { RequestOrigin, SessionUser } from './types'

/**
 * Вход через Telegram.
 *
 * Сюда попадают уже проверенные данные: подпись сверяется раньше,
 * в обработчике адреса. Этот файл отвечает только за то, что делать
 * с человеком, чья подлинность уже доказана.
 *
 * Три случая:
 *   1. Такой человек уже есть   → открываем сессию
 *   2. Человека нет             → создаём участника и открываем сессию
 *   3. Это владелец, и он первый → дополнительно выдаём роль владельца
 */

/** Имя для показа, собранное из того, что прислал Telegram */
function buildDisplayName(data: TelegramAuthData): string {
  const parts = [data.first_name, data.last_name].filter(Boolean)
  const name = parts.join(' ').trim()

  // У человека может не быть имени в Telegram — тогда берём имя пользователя
  return name || data.username || 'Участник клуба'
}

/** Всё, что прислал Telegram, — сохраняем для поддержки и поиска */
function buildProviderData(data: TelegramAuthData): Record<string, unknown> {
  return {
    firstName: data.first_name,
    ...(data.last_name ? { lastName: data.last_name } : {}),
    ...(data.username ? { username: data.username } : {}),
    ...(data.photo_url ? { photoUrl: data.photo_url } : {}),
    lastLoginAt: new Date().toISOString(),
  }
}

/**
 * Назначение владельца при первом входе.
 *
 * Роль выдаётся только тому, чей идентификатор указан в настройках,
 * и только если у него ещё нет ни одной роли. Второе условие защищает
 * от возврата роли человеку, у которого её осознанно забрали.
 *
 * Дальше права меняются в интерфейсе, а не через файл настроек.
 */
async function grantOwnerRoleIfNeeded(userId: string, telegramId: string): Promise<void> {
  const ownerTelegramId = serverEnv.OWNER_TELEGRAM_ID?.trim()

  if (!ownerTelegramId || ownerTelegramId !== telegramId) return
  if (await hasAnyRole(userId)) return

  await grantRoleByCode(userId, OWNER_ROLE_CODE, null)
  getLogger().info({ userId }, 'выдана роль владельца при первом входе')
}

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
      displayName: buildDisplayName(data),
      providerData: buildProviderData(data),
    }))

  if (isNewUser) {
    log.info({ userId: identity.userId }, 'создан новый участник')
  } else {
    // Имя на платформе не трогается: человек мог поменять его у нас
    // осознанно. Фотография из Telegram не подставляется вовсе — её
    // участник загружает сам (см. TelegramProfile в repository.ts)
    await updateTelegramIdentityData(telegramId, buildProviderData(data))
  }

  await grantOwnerRoleIfNeeded(identity.userId, telegramId)

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
