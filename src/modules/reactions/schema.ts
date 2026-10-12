import { index, pgEnum, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core'

import { users } from '@/modules/identity/schema'
import { createdAt, updatedAt } from '@/shared/db/columns'

import { REACTION_TARGETS } from './types'

/**
 * Реакции (ADR-0032).
 *
 * ─────────────────────────────────────────────────────────────────
 * РЕАКЦИЯ — НЕ ОБСУЖДЕНИЕ
 *
 * Комментариев на платформе по-прежнему нет: живое общение в Telegram,
 * и дублировать его нельзя. Реакция — один клик, «мне понравилось»;
 * с чатом она не конкурирует, а для адвент-календаря она и есть механика:
 * окошко открывается, когда набрано нужное число.
 * ─────────────────────────────────────────────────────────────────
 */

export const reactionTargetEnum = pgEnum('reaction_target', REACTION_TARGETS)

export const reactions = pgTable(
  'reactions',
  {
    targetType: reactionTargetEnum('target_type').notNull(),

    /**
     * Внешнего ключа нет — как у избранного: ссылаться разом на разные
     * таблицы средствами базы невозможно. Строки удалённой новости никому
     * не видны: сводки собираются только для существующих объектов
     */
    targetId: uuid('target_id').notNull(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /**
     * Какая реакция. Текстом, а не перечислением базы: набор задан
     * в коде, и его изменение не должно требовать миграции
     */
    emoji: text('emoji').notNull(),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    /*
     * Одна реакция от человека на объект — составным ключом, на уровне
     * базы. Для адвента это принципиально: порог считается людьми,
     * а не нажатиями, и накрутить его повторными кликами нельзя
     */
    primaryKey({ columns: [table.targetType, table.targetId, table.userId] }),
    index('reactions_user_idx').on(table.userId),
  ],
)
