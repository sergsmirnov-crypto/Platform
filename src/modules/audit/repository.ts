import 'server-only'

import { db } from '@/shared/db'

import { auditLog } from './schema'

/**
 * Запросы к журналу действий.
 *
 * Единственное место модуля, где есть SQL.
 */

export type AuditRow = {
  actorId: string | null
  action: string
  entityType: string | null
  entityId: string | null
  entityTitle: string | null
  diff: Record<string, unknown> | null
  ipHash: string | null
}

export async function insertAuditEntry(row: AuditRow): Promise<void> {
  await db.insert(auditLog).values(row)
}
