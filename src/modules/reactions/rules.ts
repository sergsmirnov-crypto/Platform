import { REACTION_KEYS } from './types'

import type { ReactionKey, ReactionSummary } from './types'

/**
 * Правила реакций. Чистые функции без базы — их же использует панель
 * в браузере, чтобы показать нажатие сразу, до ответа сервера.
 */

export const EMPTY_SUMMARY: ReactionSummary = { counts: [], total: 0, mine: null }

/** Есть ли такая реакция в наборе */
export function isReactionKey(value: unknown): value is ReactionKey {
  return typeof value === 'string' && (REACTION_KEYS as readonly string[]).includes(value)
}

/**
 * Собирает сводку из сырых счётчиков.
 *
 * Реакции, которых больше нет в наборе, отбрасываются: их уже не
 * нарисовать, а показывать «3» без значка хуже, чем не показывать.
 */
export function buildSummary(
  rows: readonly { emoji: string; count: number }[],
  mine: string | null,
): ReactionSummary {
  const byKey = new Map<ReactionKey, number>()

  for (const row of rows) {
    if (!isReactionKey(row.emoji) || row.count <= 0) continue
    byKey.set(row.emoji, (byKey.get(row.emoji) ?? 0) + row.count)
  }

  const counts = REACTION_KEYS.filter((key) => byKey.has(key)).map((key) => ({
    key,
    count: byKey.get(key) ?? 0,
  }))

  return {
    counts,
    total: counts.reduce((sum, item) => sum + item.count, 0),
    mine: isReactionKey(mine) ? mine : null,
  }
}

/**
 * Сводка после того, как человек выбрал реакцию (или снял свою — `null`).
 *
 * Одна реакция от человека: новая заменяет прежнюю. Нужна панели, чтобы
 * показать результат сразу; сервер затем пришлёт настоящую сводку.
 */
export function applyReaction(summary: ReactionSummary, next: ReactionKey | null): ReactionSummary {
  if (summary.mine === next) return summary

  const rows = summary.counts.map((item) => ({ emoji: item.key as string, count: item.count }))

  const change = (key: ReactionKey, delta: number) => {
    const row = rows.find((item) => item.emoji === key)
    if (row) row.count += delta
    else if (delta > 0) rows.push({ emoji: key, count: delta })
  }

  if (summary.mine) change(summary.mine, -1)
  if (next) change(next, 1)

  return buildSummary(rows, next)
}

/**
 * Что выбрать по нажатию на реакцию: та же, что уже стоит, — снять,
 * любая другая — поставить вместо прежней.
 */
export function nextReaction(
  current: ReactionKey | null,
  pressed: ReactionKey,
): ReactionKey | null {
  return current === pressed ? null : pressed
}
