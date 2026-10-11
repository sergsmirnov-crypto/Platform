/**
 * Публичный вход модуля личной библиотеки.
 *
 * Наружу отдаются только чистые правила, тексты и типы. Чтение и запись —
 * через `service.ts`: он помечен `server-only`, и случайный импорт
 * из компонента браузера не соберётся.
 *
 * Модуль намеренно ничего не знает о том, что именно отложено. Название
 * разбора, адрес урока и обложку эфира собирает слой приложения — только
 * ему разрешено обращаться сразу к нескольким модулям содержимого.
 * Тот же приём, что у кнопки «Продолжить» (см. `app/app/_lib/resume.ts`).
 */
export {
  countByEntity,
  DEFAULT_FAVORITE_TAB,
  FAVORITE_TABS,
  favoriteKey,
  filterByTab,
  isLimitReached,
  parseFavoriteTab,
  sortByRecent,
  toFavoriteKeys,
} from './rules'
export type { FavoriteTab } from './rules'

export {
  countNotesByEntity,
  groupNotes,
  isNoteTooLong,
  isValidTimecode,
  noteGroupKey,
  normalizeNoteBody,
  sortNotes,
} from './notes-rules'

export { libraryStrings } from './strings'

export {
  FAVORITE_ENTITIES,
  favoriteEntitySchema,
  favoriteRefSchema,
  NOTE_ENTITIES,
  noteEntitySchema,
  noteRefSchema,
} from './types'
export type { FavoriteEntity, FavoriteRef, FavoriteRow, Note, NoteEntity, NoteRef } from './types'
