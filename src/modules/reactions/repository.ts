import 'server-only'

import { and, count, eq, inArray } from 'drizzle-orm'

import { db } from '@/shared/db'

import { reactions } from './schema'

import type { ReactionKey, ReactionTarget } from './types'

/** Запросы реакций. Единственное место модуля, где есть SQL */

/** Ставит реакцию человека или заменяет прежнюю */
export async function upsertReaction(
  targetType: ReactionTarget,
  targetId: string,
  userId: string,
  emoji: ReactionKey,
): Promise<void> {
  await db
    .insert(reactions)
    .values({ targetType, targetId, userId, emoji })
    .onConflictDoUpdate({
      target: [reactions.targetType, reactions.targetId, reactions.userId],
      set: { emoji, updatedAt: new Date() },
    })
}

export async function deleteReaction(
  targetType: ReactionTarget,
  targetId: string,
  userId: string,
): Promise<void> {
  await db
    .delete(reactions)
    .where(
      and(
        eq(reactions.targetType, targetType),
        eq(reactions.targetId, targetId),
        eq(reactions.userId, userId),
      ),
    )
}

/** Счётчики по каждой реакции сразу для нескольких объектов */
export async function countReactions(targetType: ReactionTarget, targetIds: readonly string[]) {
  if (targetIds.length === 0) return []

  return db
    .select({ targetId: reactions.targetId, emoji: reactions.emoji, count: count() })
    .from(reactions)
    .where(and(eq(reactions.targetType, targetType), inArray(reactions.targetId, [...targetIds])))
    .groupBy(reactions.targetId, reactions.emoji)
}

/** Реакции самого человека на эти объекты */
export async function findOwnReactions(
  targetType: ReactionTarget,
  targetIds: readonly string[],
  userId: string,
) {
  if (targetIds.length === 0) return []

  return db
    .select({ targetId: reactions.targetId, emoji: reactions.emoji })
    .from(reactions)
    .where(
      and(
        eq(reactions.targetType, targetType),
        inArray(reactions.targetId, [...targetIds]),
        eq(reactions.userId, userId),
      ),
    )
}
