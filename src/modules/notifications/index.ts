/**
 * Публичный вход модуля уведомлений.
 *
 * Отвечает на три вопроса: «сообщить человеку, что произошло», «что мне
 * приходило» и «что присылать, а что нет».
 *
 * Наружу отдаются чистые правила, каталог типов, тексты и типы данных.
 * Чтение и запись — через `service.ts`, отправка — через `delivery.ts`:
 * оба помечены `server-only`.
 *
 * Модуль намеренно не знает, **о чём** уведомление: заголовок и адрес
 * собирает тот, кто его создаёт. Иначе сюда пришлось бы затащить разборы,
 * эфиры, курс и подписки — то есть половину платформы.
 */
export {
  isKnownNotificationType,
  NOTIFICATION_CATALOG,
  NOTIFICATION_LIST,
  NOTIFICATION_TYPES,
} from './catalog'
export type { NotificationDelivery, NotificationType, NotificationTypeDefinition } from './catalog'

export {
  buildDigestText,
  formatUnreadBadge,
  isEnabledFor,
  isImmediate,
  resolvePreferences,
} from './rules'
export type { DigestItem, PreferenceOverride, ResolvedPreference } from './rules'

export { notificationStrings } from './strings'

export type { NotificationInput, NotificationRow } from './types'
