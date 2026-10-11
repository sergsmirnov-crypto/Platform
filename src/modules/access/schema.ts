import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uuid,
} from 'drizzle-orm/pg-core'

import { users } from '@/modules/identity/schema'
import { createdAt, primaryId, timestampTz } from '@/shared/db/columns'

/**
 * Роли и права.
 *
 * Модель из PRD v0.3: итоговые права человека складываются из трёх слоёв.
 *
 *   права всех его ролей
 * + персональные разрешения
 * − персональные запреты
 * ─────────────────────────
 * = что человек реально может
 *
 * Запрет всегда сильнее разрешения. Такая модель даёт готовые пресеты
 * на каждый день и при этом позволяет любому куратору точечно добавить
 * или отнять возможность, не создавая ради этого новую роль.
 */

/** Область действия права: только свой контент или любой */
export const permissionScopeEnum = pgEnum('permission_scope', ['own', 'all'])
/** Персональное исключение: выдать право или отнять */
export const permissionEffectEnum = pgEnum('permission_effect', ['grant', 'deny'])

export const permissions = pgTable('permissions', {
  /** Ключ вида 'songs.edit' — он же используется в коде */
  key: text('key').primaryKey(),
  /** Группа для отображения в интерфейсе: 'songs', 'streams' */
  groupKey: text('group_key').notNull(),
  title: text('title').notNull(),
  description: text('description'),

  /** Поддерживает ли право разделение own/all */
  isScoped: boolean('is_scoped').notNull().default(false),
  /**
   * Опасные права: выдача прав другим, ручная выдача подписки.
   * Их назначение требует подтверждения и всегда пишется в журнал.
   */
  isSensitive: boolean('is_sensitive').notNull().default(false),

  orderIndex: integer('order_index').notNull().default(0),
})

export const roles = pgTable('roles', {
  id: primaryId(),
  code: text('code').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  /** Системные роли нельзя удалить из интерфейса */
  isSystem: boolean('is_system').notNull().default(false),
  orderIndex: integer('order_index').notNull().default(0),
  createdAt: createdAt(),
})

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionKey: text('permission_key')
      .notNull()
      .references(() => permissions.key, { onDelete: 'cascade' }),
    scope: permissionScopeEnum('scope'),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionKey] })],
)

export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),

    /** Кто выдал роль — для журнала действий */
    grantedBy: uuid('granted_by').references(() => users.id, { onDelete: 'set null' }),
    grantedAt: timestampTz('granted_at').notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.roleId] }),
    index('user_roles_role_idx').on(table.roleId),
  ],
)

/** Персональные отклонения от пресета роли */
export const userPermissions = pgTable(
  'user_permissions',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permissionKey: text('permission_key')
      .notNull()
      .references(() => permissions.key, { onDelete: 'cascade' }),

    effect: permissionEffectEnum('effect').notNull(),
    scope: permissionScopeEnum('scope'),

    grantedBy: uuid('granted_by').references(() => users.id, { onDelete: 'set null' }),
    /** Необязательный комментарий: почему сделано исключение */
    reason: text('reason'),
    grantedAt: timestampTz('granted_at').notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.permissionKey] })],
)
