/**
 * Публичный вход модуля новостей.
 *
 * Новости — то же, что главная ветка чата клуба: дайджесты, анонсы,
 * поздравления (ADR-0032). Реакции есть, комментариев нет: общение
 * живёт в Telegram, и дублировать его здесь нельзя (v0.1, приложение А).
 *
 * Содержимое хранится общим блочным форматом (`shared/blocks`) — тем же,
 * что у уроков. Свой формат означал бы второй редактор, второй
 * отрисовщик и два разных набора возможностей у людей, пишущих в одном
 * и том же клубе.
 */
export {
  isPinnedNow,
  isValidDiscussionUrl,
  parseNewsKind,
  pinDayFromDeadline,
  pinDeadlineFromDay,
} from './rules'
export { newsStrings } from './strings'

export { NEWS_KINDS } from './types'
export type { ManageNewsRow, NewsCard, NewsKind, NewsPostView } from './types'
