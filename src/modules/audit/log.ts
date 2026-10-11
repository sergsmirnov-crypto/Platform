import 'server-only'

import { requirePermission } from '@/modules/access'
import { appConfig } from '@/shared/config'

import { describeAction } from './log-catalog'
import { DEFAULT_LOG_FILTERS } from './log-filters'
import { countLogEntries, deleteLogEntriesBefore, findLogPage } from './log-repository'

import type { LogGroup } from './log-catalog'
import type { LogEntityRef, LogFilters } from './log-filters'

/**
 * Чтение журнала действий.
 *
 * Право `audit.view` проверяется здесь, как и во всех остальных
 * модулях: скрытый в интерфейсе пункт меню — удобство, а не защита
 * (ARCHITECTURE §6).
 *
 * До шага 9.6.1 проверка стояла в странице: модуль прав писал выдачу
 * прав в журнал, и обратный импорт замкнул бы модули в кольцо. Теперь
 * записью занимается слой действий, кольца нет, исключение снято.
 */

export type AuditEntry = {
  id: string
  /** Что произошло, словами: «опубликован разбор» */
  label: string
  group: LogGroup
  /** Заметное действие: удаление, права, вмешательство в подписку */
  isNotable: boolean
  /** Кто сделал. Пусто — сделала система */
  actor: { id: string; name: string } | null
  /**
   * Над чем. Название — снимок на момент действия для содержимого
   * и текущее имя для участников. Пусто, если действие ни к чему
   * не привязано (вход в режим «как участник»)
   */
  entity: (LogEntityRef & { title: string | null }) | null
  /** Что именно изменилось. Показывается по раскрытию строки */
  diff: Record<string, unknown> | null
  at: Date
}

export type AuditLogPage = {
  entries: AuditEntry[]
  total: number
  page: number
  pageCount: number
  /** До какой даты вообще хранятся записи — показывается внизу списка */
  keptSince: Date
}

export async function getAuditLogPage(
  actorId: string,
  filters: LogFilters = DEFAULT_LOG_FILTERS,
  now: Date = new Date(),
): Promise<AuditLogPage> {
  await requirePermission(actorId, 'audit.view')

  const pageSize = appConfig.manage.logPageSize

  const [total, rows] = await Promise.all([
    countLogEntries(filters, now),
    findLogPage(filters, { limit: pageSize, offset: (filters.page - 1) * pageSize }, now),
  ])

  return {
    entries: rows.map((row) => {
      const descriptor = describeAction(row.action)

      return {
        id: String(row.id),
        label: descriptor.label,
        group: descriptor.group,
        isNotable: descriptor.notable === true,
        actor: row.actorId
          ? { id: row.actorId, name: row.actorName ?? 'Удалённый участник' }
          : null,
        entity: row.entityType
          ? {
              type: row.entityType,
              id: row.entityId ?? '',
              // Имя участника берётся при чтении, название содержимого —
              // из снимка. Первое всегда свежее, второе всегда есть
              title: row.targetName ?? row.entityTitle,
            }
          : null,
        diff: row.diff,
        at: row.createdAt,
      }
    }),
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    keptSince: retentionThreshold(now),
  }
}

/**
 * Убирает записи старше срока хранения.
 *
 * Вызывается фоновой задачей раз в сутки. Без уборки таблица растёт
 * вечно: каждое действие каждого куратора оставляет строку, и через
 * несколько лет журнал начнёт замедлять сам себя ровно в тот момент,
 * когда понадобится.
 */
export async function purgeOldAuditEntries(now: Date = new Date()): Promise<number> {
  return deleteLogEntriesBefore(retentionThreshold(now))
}

function retentionThreshold(now: Date): Date {
  return new Date(now.getTime() - appConfig.manage.logRetentionDays * 24 * 60 * 60 * 1000)
}
