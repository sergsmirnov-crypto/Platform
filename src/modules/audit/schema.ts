import { desc } from 'drizzle-orm'
import { bigserial, index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'

import { users } from '@/modules/identity/schema'
import { createdAt } from '@/shared/db/columns'

/**
 * Журнал действий и системные настройки.
 *
 * Практическая польза журнала — не в безопасности, а в разборе ситуаций
 * вроде «куда делся разбор Nothing Else Matters»: ответ находится
 * за десять секунд вместо часа переписки (PRD v0.3 §6).
 */

export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),

    /** Кто сделал. Может быть пустым, если действие выполнила система */
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),

    /** Что сделал: 'song.publish', 'user.role_granted' */
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),

    /**
     * Как объект назывался В МОМЕНТ ДЕЙСТВИЯ.
     *
     * Снимок, а не ссылка, и это главное свойство журнала. Разбор
     * удаляют — строка из `songs` исчезает, и восстановить название
     * по идентификатору становится нечем. Между тем «куда делся разбор
     * Nothing Else Matters» — ровно тот вопрос, ради которого журнал
     * и заведён (PRD v0.3 §6): без снимка на экране остался бы
     * идентификатор вида `7f3a…`, не значащий ни для кого ничего.
     *
     * Исключение — участники: их строки удаляются мягко, поэтому имя
     * человека берётся при чтении и остаётся верным даже после
     * переименования.
     */
    entityTitle: text('entity_title'),

    /** Что именно изменилось: было и стало */
    diff: jsonb('diff').$type<Record<string, unknown>>(),

    ipHash: text('ip_hash'),
    createdAt: createdAt(),
  },
  (table) => [
    index('audit_log_actor_idx').on(table.actorId, table.createdAt),
    index('audit_log_entity_idx').on(table.entityType, table.entityId),
    /** Журнал всегда листается от свежего: это его единственный порядок */
    index('audit_log_created_idx').on(desc(table.createdAt)),
  ],
)

/*
 * Таблица `notifications` переехала в модуль `notifications` (шаг 10.3).
 * Миграции это не потребовало: имя таблицы и колонки не изменились.
 * Общего с журналом действий у неё не было ничего, кроме истории появления.
 */
