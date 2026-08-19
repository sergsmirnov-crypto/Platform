import { boolean, index, integer, pgEnum, pgTable, smallint, uniqueIndex, uuid } from 'drizzle-orm/pg-core' // prettier-ignore

import { users } from '@/modules/identity/schema'
import { createdAt, primaryId, timestampTz, updatedAt } from '@/shared/db/columns'

/**
 * Прогресс участника.
 *
 * ─────────────────────────────────────────────────────────────────
 * ОДНА ТАБЛИЦА НА ВСЕ ВИДЫ СОДЕРЖИМОГО
 *
 * Напрашивается по таблице на вид: `lesson_progress`, `song_progress`,
 * `stream_progress`. Отвергнуто из-за главной кнопки платформы.
 *
 * Кнопка «Продолжить» на главной должна ответить на вопрос «что человек
 * трогал последним» — по всем видам сразу. С отдельными таблицами это
 * объединение четырёх запросов при каждом открытии главной, и каждый
 * новый вид содержимого его удлиняет. С одной таблицей — один запрос
 * по индексу.
 *
 * Плата за обобщение — отсутствие внешнего ключа на объект: `entity_id`
 * ссылается неизвестно куда, и целостность базой не проверяется.
 * Осознанно: удалённый урок оставляет висящую строку прогресса, которая
 * никому не мешает и не показывается, потому что чтение всегда идёт
 * через соединение с самим объектом.
 * ─────────────────────────────────────────────────────────────────
 */

/**
 * Что можно проходить.
 *
 * Свой список, а не общий `content_entity`: у песни прогресса нет —
 * проходят конкретный вариант разбора, а не песню вообще. Общий
 * перечень пускал бы в таблицу бессмысленные значения, а разница
 * в одно слово («песня» против «вариант разбора») — это ровно тот
 * случай, когда бессмысленное значение попадает в базу незаметно.
 */
export const progressEntityEnum = pgEnum('progress_entity', [
  'arrangement',
  'arrangement_section',
  'lesson',
  'course_module',
  'stream',
])

export type ProgressEntity = (typeof progressEntityEnum.enumValues)[number]

/**
 * Состояние прохождения.
 *
 * `not_started` в базе не хранится: отсутствие строки и есть «не начато».
 * Значение оставлено в перечислении для кода, который отвечает на вопрос
 * о состоянии, — иначе каждому месту пришлось бы обрабатывать `null`
 * отдельно.
 */
export const progressStatusEnum = pgEnum('progress_status', [
  'not_started',
  'in_progress',
  'completed',
])

export type ProgressStatus = (typeof progressStatusEnum.enumValues)[number]

export const progress = pgTable(
  'progress',
  {
    id: primaryId(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    entityType: progressEntityEnum('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),

    status: progressStatusEnum('status').notNull().default('in_progress'),

    /** Где остановился в ролике. Ради этого и существует «Продолжить» */
    positionSec: integer('position_sec').notNull().default(0),

    /** Доля просмотренного, 0–100. Для колец прогресса в карточках */
    percent: smallint('percent').notNull().default(0),

    /**
     * Отмечено человеком вручную.
     *
     * Автоматика по просмотру ролика такую отметку не снимает: если
     * человек сказал «прошёл», значит прошёл — даже если смотрел
     * с телефона на кухне и до конца не досмотрел.
     */
    completedManually: boolean('completed_manually').notNull().default(false),

    firstOpenedAt: timestampTz('first_opened_at'),
    lastActivityAt: timestampTz('last_activity_at'),
    completedAt: timestampTz('completed_at'),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    // Прогресс у человека по объекту ровно один
    uniqueIndex('progress_unique_idx').on(table.userId, table.entityType, table.entityId),
    // Главный запрос платформы: «что человек трогал последним»
    index('progress_recent_idx').on(table.userId, table.lastActivityAt),
    // Обратный вопрос: «сколько человек прошло этот урок»
    index('progress_entity_idx').on(table.entityType, table.entityId),
  ],
)
