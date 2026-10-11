/**
 * Публичный вход в модуль журнала действий.
 *
 * Отвечает на два вопроса: «записать, что это произошло» и «кто, что
 * и когда сделал». Первым пользуются все модули и действия, вторым —
 * только экран журнала.
 *
 * Настройки платформы жили здесь до шага 9.6.1 и переехали в модуль
 * `settings`: общего у них не было ничего, кроме истории появления.
 */
export { recordAudit } from './service'
export type { AuditEvent } from './service'

export { AUDIT_ACTIONS } from './actions.catalog'
export type { AuditAction } from './actions.catalog'

export { getAuditLogPage, purgeOldAuditEntries } from './log'
export type { AuditEntry, AuditLogPage } from './log'
export {
  buildLogQuery,
  DEFAULT_LOG_FILTERS,
  hasActiveLogFilters,
  LOG_PERIODS,
  parseLogFilters,
} from './log-filters'
export type { LogEntityRef, LogFilters, LogPeriod } from './log-filters'
export { LOG_GROUPS } from './log-catalog'
export type { LogGroup } from './log-catalog'
export { logStrings } from './log-strings'
