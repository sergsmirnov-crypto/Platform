/**
 * Публичный вход модуля эфиров.
 *
 * Наружу — чистые правила, типы и тексты. Чтение из базы живёт
 * в `service.ts` с пометкой `server-only`.
 */
export {
  canJoin,
  formatDuration,
  isUpcoming,
  LIVE_GRACE_HOURS,
  streamPhase,
  timeUntil,
} from './domain'
export type { StreamPhase, StreamStateInput } from './domain'

export {
  archiveOffset,
  buildArchiveQuery,
  hasArchiveFilters,
  parseArchiveFilters,
  searchTerms,
} from './archive-filters'
export type { ArchiveFilters, RawSearchParams } from './archive-filters'

export {
  buildCalendarEvent,
  CLUB_TIMEZONE_LABEL,
  fromClubInputValue,
  toClubInputValue,
  formatArchiveDate,
  formatStreamDateTime,
  formatStreamDay,
  formatStreamTime,
  isSameClockAsClub,
} from './schedule'
export type { CalendarEvent } from './schedule'

// Таймкоды живут в общем слое — ими пользуются и разборы.
// Наружу отдаются отсюда, чтобы страницы эфиров не знали, где именно
export { formatTimecode, parseTimecode } from '@/shared/utils/timecode'

export { findChapterIssues, normalizeChapters } from './chapters'
export type { ChapterDraft, ChapterIssue, NormalizedChapter } from './chapters'

export {
  chapterInputSchema,
  chaptersInputSchema,
  streamInputSchema,
  streamSongsInputSchema,
} from './editor-schema'
export type { StreamInput } from './editor-schema'

export { streamStateEnum } from './schema'
export type { StreamState } from './schema'

export { streamStrings } from './strings'

export type { StreamCard, StreamChapter, StreamRef, StreamSong, StreamView } from './types'
