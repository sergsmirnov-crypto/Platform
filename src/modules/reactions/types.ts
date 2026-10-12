import { z } from 'zod'

/**
 * Типы модуля реакций.
 *
 * Перечни живут здесь, а не в `schema.ts`, по той же причине, что у
 * библиотеки: панель реакций — компонент браузера, и вместе с перечнем
 * из `schema.ts` в браузер уехал бы драйвер базы данных.
 */

/**
 * К чему можно поставить реакцию.
 *
 * Сегодня — к новостям клуба. Следующим появится окошко адвент-календаря:
 * новый вид — новое значение здесь и одна строка проверки видимости
 * в слое приложения, а таблица и панель остаются прежними.
 */
export const REACTION_TARGETS = ['news_post'] as const

export type ReactionTarget = (typeof REACTION_TARGETS)[number]

/**
 * Набор реакций — «Реакции» из фирменного эмодзи-пака (Figma).
 *
 * Порядок здесь и есть порядок показа. Набор задан в коде, а не в базе:
 * у реакции есть значок, а значок — это код. Строка в базе без значка
 * бесполезна (то же решение, что с типами уведомлений, ADR-0025).
 *
 * Убрать реакцию из набора можно без миграции: уже поставленные
 * просто перестанут показываться и считаться.
 */
export const REACTION_KEYS = [
  'heart',
  'like',
  'fire',
  'hundred',
  'party',
  'eyes',
  'crown',
  'plus_one',
  'rocket',
  'dislike',
] as const

export type ReactionKey = (typeof REACTION_KEYS)[number]

/** Одна реакция в сводке */
export type ReactionCount = {
  key: ReactionKey
  count: number
}

/**
 * Сводка реакций под объектом — всё, что нужно панели.
 *
 * Только ненулевые счётчики, в порядке набора. Реакция человека —
 * отдельно: одна на объект, как и задумано (одна от человека, ADR-0032).
 */
export type ReactionSummary = {
  counts: ReactionCount[]
  total: number
  mine: ReactionKey | null
}

export const reactionTargetSchema = z.enum(REACTION_TARGETS)
export const reactionKeySchema = z.enum(REACTION_KEYS)
