/**
 * Публичный вход в модуль настроек платформы.
 *
 * Отвечает на вопрос «какой текст и какие ссылки показать участнику»,
 * когда ответ на него меняет человек без разработчика: ссылки на чаты,
 * адрес продления подписки, содержимое страницы «О клубе».
 *
 * От `shared/config/app.config.ts` отличается тем, что там живут
 * значения, одинаковые на всех серверах и являющиеся частью продукта,
 * а здесь — то, что правят из интерфейса.
 *
 * До шага 9.6.1 всё это лежало внутри модуля журнала действий. Общего
 * у них не было ничего, кроме истории появления.
 */
export { getSetting, setSetting } from './service'
export { getEditableSettings, resetSetting, updateSetting } from './admin'
export type { EditableSettings } from './admin'

export {
  clubAboutSchema,
  isEditableSetting,
  MAX_CHAT_CARDS,
  renewUrlSchema,
  telegramChatsSchema,
} from './validation'
export type { EditableSettingKey } from './validation'

export { SETTING_DEFAULTS, SETTING_KEYS, SETTING_TITLES } from './catalog'
export type { ClubAbout, ClubPoint, ClubQuestion, SettingKey, TelegramChatLink } from './catalog'

export { settingsStrings } from './strings'
