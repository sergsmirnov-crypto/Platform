import { sql } from 'drizzle-orm'
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import { users } from '@/modules/identity/schema'
import { mediaAssets } from '@/modules/media/schema'
import { createdAt, primaryId, timestampTz, updatedAt } from '@/shared/db/columns'
import { publicationStatusEnum } from '@/shared/db/enums'

/**
 * Онлайн-курс: путь, а не библиотека.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЧЕМ КУРС ОТЛИЧАЕТСЯ ОТ РАЗБОРОВ
 *
 * Разборы — библиотека: человек приходит за конкретной песней и уходит.
 * Курс проходится по порядку, у него есть начало, конец и запомненное
 * место остановки.
 *
 *   курс          «Гитара с нуля»
 *     └ модуль    «Первые аккорды»
 *         └ урок  «Аккорд Am» — видео, текст, материалы
 *
 * Три уровня, а не два: без модулей курс из сорока уроков превращается
 * в список, по которому нельзя понять, где ты находишься. Модуль — это
 * ответ на вопрос «сколько ещё осталось», а не украшение.
 * ─────────────────────────────────────────────────────────────────
 *
 * Таблица курсов заводится сразу, хотя курс сегодня один. Это ничего
 * не стоит и избавляет от миграции в тот день, когда появится второй —
 * например «Электрогитара» рядом с «Гитарой с нуля».
 */

/** Тип для поискового вектора: см. пояснение в схеме разборов */
const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
})

export const courses = pgTable(
  'courses',
  {
    id: primaryId(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    description: text('description'),

    coverAssetId: uuid('cover_asset_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),

    status: publicationStatusEnum('status').notNull().default('draft'),
    orderIndex: integer('order_index').notNull().default(0),

    publishedAt: timestampTz('published_at'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex('courses_slug_idx').on(table.slug)],
)

export const courseModules = pgTable(
  'course_modules',
  {
    id: primaryId(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),

    /** Адрес: /app/learn/course/[module]. Уникален внутри курса, не глобально */
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    description: text('description'),

    orderIndex: integer('order_index').notNull().default(0),
    status: publicationStatusEnum('status').notNull().default('draft'),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    // Внутри курса адреса уникальны, между курсами — нет: «основы»
    // может быть и в курсе гитары, и в курсе укулеле
    uniqueIndex('course_modules_slug_idx').on(table.courseId, table.slug),
    index('course_modules_order_idx').on(table.courseId, table.orderIndex),
  ],
)

export const lessons = pgTable(
  'lessons',
  {
    id: primaryId(),
    moduleId: uuid('module_id')
      .notNull()
      .references(() => courseModules.id, { onDelete: 'cascade' }),

    slug: text('slug').notNull(),
    title: text('title').notNull(),

    /** Одна строка «что освоишь» — показывается в карте курса под названием */
    summary: text('summary'),

    /**
     * Содержимое урока: список блоков.
     *
     * Хранится как JSON и разбирается при чтении (`content.ts`). Своим
     * форматом, а не форматом стороннего редактора: чужая схема меняется
     * с их версиями, а отрисовывать её всё равно пришлось бы самим.
     * Подробно — ADR-0018.
     */
    content: jsonb('content'),

    videoAssetId: uuid('video_asset_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),

    /** Сколько примерно займёт: карта курса обещает «осталось ~40 минут» */
    estimatedMinutes: integer('estimated_minutes'),

    /**
     * Урок открыт без подписки.
     *
     * Нужен для двух вещей: показать участнику с истёкшей подпиской, что
     * он теряет, и однажды — для витрины. Поле заводится сразу, потому
     * что добавить его позже означало бы миграцию ради одного `boolean`.
     */
    isFreePreview: boolean('is_free_preview').notNull().default(false),

    orderIndex: integer('order_index').notNull().default(0),
    status: publicationStatusEnum('status').notNull().default('draft'),

    publishedAt: timestampTz('published_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),

    /**
     * Поисковый образ урока.
     *
     * Только название и краткое описание: содержимое лежит в JSON,
     * и вытаскивать из него текст выражением вычисляемой колонки —
     * способ получить неотлаживаемое выражение ради сомнительной пользы.
     * Человек ищет урок по названию, а не по фразе из третьего абзаца.
     */
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`setweight(to_tsvector('russian', coalesce(title, '')), 'A') ||
          setweight(to_tsvector('russian', coalesce(summary, '')), 'B')`,
    ),
  },
  (table) => [
    uniqueIndex('lessons_slug_idx').on(table.moduleId, table.slug),
    index('lessons_order_idx').on(table.moduleId, table.orderIndex),
    index('lessons_search_idx').using('gin', table.searchVector),
  ],
)
