import 'server-only'

import { errors } from '@/shared/errors'

import { countReactions, deleteReaction, findOwnReactions, upsertReaction } from './repository'
import { buildSummary, EMPTY_SUMMARY, isReactionKey } from './rules'

import type { ReactionKey, ReactionSummary, ReactionTarget } from './types'

/**
 * Реакции: поставить, снять, посчитать.
 *
 * Модуль не знает, к чему ставится реакция и видно ли это человеку.
 * Видимость проверяет слой приложения до вызова — так же, как у
 * избранного: иначе реакция стала бы способом узнать о чужом черновике.
 */

/**
 * Ставит реакцию человека (одну на объект) или снимает её — `null`.
 *
 * @returns свежая сводка: панель показывает её вместо своей догадки
 */
export async function setReaction(
  userId: string,
  target: { type: ReactionTarget; id: string },
  reaction: ReactionKey | null,
): Promise<ReactionSummary> {
  if (reaction === null) {
    await deleteReaction(target.type, target.id, userId)
  } else {
    if (!isReactionKey(reaction)) throw errors.validation({ reaction: 'Такой реакции нет' })
    await upsertReaction(target.type, target.id, userId, reaction)
  }

  const summaries = await getReactionSummaries(target.type, [target.id], userId)

  return summaries[target.id] ?? EMPTY_SUMMARY
}

/**
 * Сводки сразу для нескольких объектов — два запроса на всю ленту,
 * а не по два на каждую карточку.
 *
 * @param viewerId чью реакцию отметить; `null` — без отметки
 */
export async function getReactionSummaries(
  targetType: ReactionTarget,
  targetIds: readonly string[],
  viewerId: string | null,
): Promise<Record<string, ReactionSummary>> {
  const [counts, own] = await Promise.all([
    countReactions(targetType, targetIds),
    viewerId ? findOwnReactions(targetType, targetIds, viewerId) : Promise.resolve([]),
  ])

  const result: Record<string, ReactionSummary> = {}

  for (const id of targetIds) {
    result[id] = buildSummary(
      counts.filter((row) => row.targetId === id),
      own.find((row) => row.targetId === id)?.emoji ?? null,
    )
  }

  return result
}
