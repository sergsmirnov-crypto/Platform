/**
 * Публичный вход модуля прогресса.
 *
 * Наружу отдаются только чистые правила и типы. Запись и чтение —
 * через `service.ts`: он помечен `server-only`, и случайный импорт
 * из компонента браузера не соберётся.
 */
export {
  completionPercent,
  COMPLETION_THRESHOLD_PERCENT,
  isCompleted,
  mergePercent,
  nextIncomplete,
  progressStatus,
  remainingMinutes,
  toPercent,
} from './rules'
export type { CompletionCount, ProgressSnapshot } from './rules'

export type { ProgressEntity, ProgressStatus } from './schema'
