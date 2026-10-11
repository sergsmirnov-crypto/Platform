/**
 * Работа с Telegram: проверка подписей и обращения к Bot API.
 *
 * Слой инфраструктуры: он умеет разговаривать с Telegram, но ничего не знает
 * ни о пользователях платформы, ни о подписках. Решения принимаются
 * в модулях `identity` и `subscription`.
 *
 * Клиент (`client.ts`) намеренно не реэкспортируется отсюда: он обращается
 * к сети и работает только на сервере. Импортируется явно:
 *
 *     import { telegram } from '@/shared/telegram/client'
 *
 * Проверка подписей и толкование статусов — чистые функции без побочных
 * эффектов, их можно использовать где угодно.
 */
export { isInChannel } from './membership'
export { DEFAULT_MAX_AUTH_AGE_SECONDS, verifyLoginWidget, verifyMiniAppInitData } from './verify'
export type { VerificationFailureReason, VerificationResult, VerifyOptions } from './verify'
export { REQUIRED_UPDATE_TYPES } from './types'
export type {
  TelegramAuthData,
  TelegramChatMember,
  TelegramChatMemberStatus,
  TelegramChatMemberUpdated,
  TelegramUpdate,
  TelegramUser,
} from './types'
