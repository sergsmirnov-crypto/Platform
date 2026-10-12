/**
 * Публичный вход модуля реакций (ADR-0032).
 *
 * Наружу — только чистые правила, тексты и типы: их использует панель
 * в браузере. Запись и чтение — через `service.ts`, он помечен
 * `server-only`.
 *
 * Модуль не знает, к чему ставится реакция: новость, окошко адвента.
 * Видимость объекта проверяет слой приложения.
 */
export { applyReaction, buildSummary, EMPTY_SUMMARY, isReactionKey, nextReaction } from './rules'
export { reactionStrings } from './strings'
export { REACTION_KEYS, REACTION_TARGETS, reactionKeySchema, reactionTargetSchema } from './types'
export type { ReactionCount, ReactionKey, ReactionSummary, ReactionTarget } from './types'
