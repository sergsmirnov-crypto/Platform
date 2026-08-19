import 'server-only'

import { eq } from 'drizzle-orm'

import { db } from '@/shared/db'

import { legalAcceptances } from './schema'

import type { AcceptableDocumentId, AcceptedVersion } from './types'

/**
 * Запросы к таблице согласий. Единственное место с SQL в модуле.
 */

export async function listAcceptances(userId: string): Promise<AcceptedVersion[]> {
  const rows = await db
    .select({
      document: legalAcceptances.document,
      version: legalAcceptances.version,
      acceptedAt: legalAcceptances.acceptedAt,
    })
    .from(legalAcceptances)
    .where(eq(legalAcceptances.userId, userId))

  return rows.map((row) => ({
    document: row.document as AcceptableDocumentId,
    version: row.version,
    acceptedAt: row.acceptedAt,
  }))
}

export type AcceptanceInsert = {
  document: AcceptableDocumentId
  version: number
}

export type AcceptanceContext = {
  ipHash?: string | null
  userAgent?: string | null
}

/**
 * Записывает согласия одной вставкой.
 *
 * Повторы игнорируются: человек мог нажать кнопку дважды или открыть
 * онбординг в двух вкладках. Это не ошибка и сообщать о ней некому —
 * согласие уже есть.
 */
export async function insertAcceptances(
  userId: string,
  documents: AcceptanceInsert[],
  context: AcceptanceContext = {},
): Promise<void> {
  if (documents.length === 0) return

  await db
    .insert(legalAcceptances)
    .values(
      documents.map((document) => ({
        userId,
        document: document.document,
        version: document.version,
        ipHash: context.ipHash ?? null,
        userAgent: context.userAgent ?? null,
      })),
    )
    .onConflictDoNothing()
}
