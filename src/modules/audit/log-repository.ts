import 'server-only'

import { and, count, desc, eq, gte, ilike, inArray, lt, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

import { users } from '@/modules/identity/schema'
import { db } from '@/shared/db'

import { actionsOfGroup } from './log-catalog'
import { periodStart } from './log-filters'
import { auditLog } from './schema'

import type { LogFilters } from './log-filters'
import type { SQL } from 'drizzle-orm'

/**
 * Запросы журнала действий.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ЗДЕСЬ ЕСТЬ ТАБЛИЦА УЧАСТНИКОВ
 *
 * Журнал хранит идентификаторы, а читателю нужны имена — и автора
 * действия, и участника, над которым оно совершено. Спросить об этом
 * модуль `identity` нельзя: он сам пишет в журнал, и взаимный импорт
 * замкнул бы модули в кольцо (ARCHITECTURE §3).
 *
 * Поэтому мы обращаемся к его ТАБЛИЦЕ напрямую — это одно из двух
 * задокументированных исключений правила зависимостей: база данных
 * является общим пространством, и внешние ключи по своей природе
 * пересекают границы модулей.
 *
 * Имена берутся при чтении, а не сохраняются в записи, ровно потому,
 * что участники удаляются мягко: строка человека остаётся, и имя
 * остаётся верным даже после переименования. Для содержимого — разборов,
 * эфиров, уроков — сделано обратное: там название сохраняется в момент
 * действия, потому что после удаления брать его будет неоткуда.
 * ─────────────────────────────────────────────────────────────────
 */

const actorUser = alias(users, 'actor_user')
const targetUser = alias(users, 'target_user')

export type AuditLogRow = {
  id: bigint
  action: string
  actorId: string | null
  actorName: string | null
  entityType: string | null
  entityId: string | null
  entityTitle: string | null
  /** Имя участника, если действие совершено над человеком */
  targetName: string | null
  diff: Record<string, unknown> | null
  createdAt: Date
}

const columns = {
  id: auditLog.id,
  action: auditLog.action,
  actorId: auditLog.actorId,
  actorName: actorUser.displayName,
  entityType: auditLog.entityType,
  entityId: auditLog.entityId,
  entityTitle: auditLog.entityTitle,
  targetName: targetUser.displayName,
  diff: auditLog.diff,
  createdAt: auditLog.createdAt,
}

/**
 * Основа запроса.
 *
 * Оба присоединения — необязательные: автором может быть система,
 * а объектом — не человек. Сравнение с текстовой колонкой требует
 * приведения типа: идентификатор объекта хранится строкой, потому что
 * объекты бывают разные, а ключи у них разных типов.
 */
function baseQuery() {
  return db
    .select(columns)
    .from(auditLog)
    .leftJoin(actorUser, eq(actorUser.id, auditLog.actorId))
    .leftJoin(
      targetUser,
      and(eq(auditLog.entityType, 'user'), sql`${targetUser.id}::text = ${auditLog.entityId}`),
    )
}

function conditions(filters: LogFilters, now: Date): SQL[] {
  const where: SQL[] = []

  const since = periodStart(filters.period, now)
  if (since) where.push(gte(auditLog.createdAt, since))

  if (filters.group) {
    const actions = actionsOfGroup(filters.group)

    // Пустой список действий означал бы «показать всё» — а должен
    // означать «в этом разделе ничего нет»
    where.push(actions.length > 0 ? inArray(auditLog.action, actions) : sql`false`)
  }

  if (filters.actorId) where.push(eq(auditLog.actorId, filters.actorId))

  if (filters.entity) {
    where.push(
      and(
        eq(auditLog.entityType, filters.entity.type),
        eq(auditLog.entityId, filters.entity.id),
      ) as SQL,
    )
  }

  if (filters.query) {
    const pattern = `%${filters.query}%`

    // Поиск идёт по названию объекта и по обоим именам: человек ищет
    // либо «что было с этим разбором», либо «что делал этот куратор»,
    // и заранее неизвестно, что именно он набрал
    where.push(
      or(
        ilike(auditLog.entityTitle, pattern),
        ilike(actorUser.displayName, pattern),
        ilike(targetUser.displayName, pattern),
      ) as SQL,
    )
  }

  return where
}

export async function findLogPage(
  filters: LogFilters,
  page: { limit: number; offset: number },
  now: Date,
): Promise<AuditLogRow[]> {
  return baseQuery()
    .where(and(...conditions(filters, now)))
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(page.limit)
    .offset(page.offset)
}

export async function countLogEntries(filters: LogFilters, now: Date): Promise<number> {
  const [row] = await db
    .select({ total: count(auditLog.id) })
    .from(auditLog)
    .leftJoin(actorUser, eq(actorUser.id, auditLog.actorId))
    .leftJoin(
      targetUser,
      and(eq(auditLog.entityType, 'user'), sql`${targetUser.id}::text = ${auditLog.entityId}`),
    )
    .where(and(...conditions(filters, now)))

  return row?.total ?? 0
}

/** Удаляет записи старше указанного момента. Возвращает, сколько удалено */
export async function deleteLogEntriesBefore(threshold: Date): Promise<number> {
  const removed = await db
    .delete(auditLog)
    .where(lt(auditLog.createdAt, threshold))
    .returning({ id: auditLog.id })

  return removed.length
}
