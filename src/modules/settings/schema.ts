import { boolean, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'

import { users } from '@/modules/identity/schema'
import { updatedAt } from '@/shared/db/columns'

/**
 * Таблицы настроек платформы.
 *
 * Раньше жили в схеме журнала действий — там их держала только история.
 * Общего у них нет ничего: журнал отвечает на вопрос «кто что изменил»,
 * настройки — «какой текст показать участнику».
 *
 * Имена таблиц не изменились, поэтому переезд не потребовал миграции.
 */

/**
 * Настройки платформы, которые меняются из интерфейса:
 * ссылки на чаты, тексты онбординга.
 */
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').$type<unknown>().notNull(),
  description: text('description'),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: updatedAt(),
})

/** Переключатели возможностей, управляемые без перезапуска приложения */
export const featureFlags = pgTable('feature_flags', {
  key: text('key').primaryKey(),
  enabled: boolean('enabled').notNull().default(false),
  /** Доля пользователей, для которых включено: 0–100 */
  rolloutPercent: integer('rollout_percent').notNull().default(0),
  description: text('description'),
  meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: updatedAt(),
})
