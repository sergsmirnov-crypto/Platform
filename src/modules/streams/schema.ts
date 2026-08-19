import { sql } from 'drizzle-orm'
import { customType, index, integer, pgEnum, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core' // prettier-ignore

import { users } from '@/modules/identity/schema'
import { mediaAssets } from '@/modules/media/schema'
import { songs } from '@/modules/songs/schema'
import { createdAt, primaryId, timestampTz, updatedAt } from '@/shared/db/columns'
import { publicationStatusEnum } from '@/shared/db/enums'

/**
 * Эфиры: анонс и запись — одна запись, а не две.
 *
 * ─────────────────────────────────────────────────────────────────
 * ГЛАВНОЕ РЕШЕНИЕ СХЕМЫ
 *
 * Напрашивается разделить «ближайшие эфиры» и «архив записей» на две
 * таблицы: у них разные экраны, разные поля и разный смысл. Отвергнуто.
 *
 * Это один и тот же эфир на разных этапах жизни. Разделение означало бы
 * переносить запись из таблицы в таблицу в тот момент, когда куратор
 * выложил видео, — а вместе с ней и напоминания, и ссылки, которые
 * участники уже сохранили, и связи с разобранными песнями.
 *
 * Поэтому одна таблица и поле состояния. Экраны разные, запись одна.
 * ─────────────────────────────────────────────────────────────────
 */

/** Тип для поискового вектора: см. пояснение в схеме разборов */
const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
})

/**
 * Этап жизни эфира.
 *
 * `live` ставится вручную куратором, а не вычисляется по времени: эфир
 * начинается на десять минут позже, затягивается на полчаса или
 * отменяется за пять минут до начала. Автоматика по расписанию врала бы
 * ровно в те моменты, когда участник смотрит на страницу.
 */
export const streamStateEnum = pgEnum('stream_state', [
  'scheduled',
  'live',
  'recorded',
  'cancelled',
])

export type StreamState = (typeof streamStateEnum.enumValues)[number]

export const streams = pgTable(
  'streams',
  {
    id: primaryId(),

    slug: text('slug').notNull(),
    title: text('title').notNull(),
    description: text('description'),

    /** Кто ведёт. Связь «эфиры этого куратора» — вход в архив по учителю */
    curatorId: uuid('curator_id').references(() => users.id, { onDelete: 'set null' }),

    startsAt: timestampTz('starts_at').notNull(),
    endedAt: timestampTz('ended_at'),

    state: streamStateEnum('state').notNull().default('scheduled'),

    /**
     * Куда идти во время эфира.
     *
     * Живёт снаружи: эфиры проходят в Telegram или Zoom, и своей
     * трансляции у платформы нет и не планируется. Ссылка временная
     * и после эфира теряет смысл — поэтому не адрес страницы, а поле.
     */
    joinUrl: text('join_url'),

    videoAssetId: uuid('video_asset_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),

    coverAssetId: uuid('cover_asset_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),

    /**
     * Статус публикации — отдельно от этапа жизни.
     *
     * Это разные вопросы. Этап отвечает «что с эфиром происходит»,
     * статус — «видят ли его участники». Куратор готовит анонс
     * черновиком за неделю и публикует, когда договорился о теме;
     * запись выкладывает после монтажа, а не в момент окончания.
     */
    status: publicationStatusEnum('status').notNull().default('draft'),

    publishedAt: timestampTz('published_at'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),

    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`setweight(to_tsvector('russian', coalesce(title, '')), 'A') ||
          setweight(to_tsvector('russian', coalesce(description, '')), 'B')`,
    ),
  },
  (table) => [
    uniqueIndex('streams_slug_idx').on(table.slug),
    // Оба экрана сортируют по дате: ближайшие — вперёд, архив — назад
    index('streams_date_idx').on(table.status, table.startsAt),
    index('streams_state_idx').on(table.state),
    index('streams_curator_idx').on(table.curatorId),
    index('streams_search_idx').using('gin', table.searchVector),
  ],
)

/**
 * Таймкоды-оглавление.
 *
 * Главная ценность архива (PRD §12, пункт 3). Эфир идёт полтора часа,
 * и целиком его не смотрит никто; оглавление превращает запись
 * в справочник, по которому находят нужные пять минут.
 *
 * Отдельная таблица, а не список в JSON: по таймкодам нужен переход
 * из плеера, а позже — поиск «в каком эфире разбирали баррэ».
 */
export const streamChapters = pgTable(
  'stream_chapters',
  {
    id: primaryId(),
    streamId: uuid('stream_id')
      .notNull()
      .references(() => streams.id, { onDelete: 'cascade' }),

    title: text('title').notNull(),
    /** Секунда от начала записи */
    startSec: integer('start_sec').notNull(),
    orderIndex: integer('order_index').notNull().default(0),
  },
  (table) => [index('stream_chapters_order_idx').on(table.streamId, table.orderIndex)],
)

/**
 * Какие песни разбирали в эфире.
 *
 * Связь в обе стороны: со страницы эфира — «разобранные песни»,
 * со страницы песни — «её разбирали в этих эфирах». Второе полезнее,
 * чем кажется: человек, застрявший на песне, находит полтора часа
 * живого разбора именно её.
 */
export const streamSongs = pgTable(
  'stream_songs',
  {
    streamId: uuid('stream_id')
      .notNull()
      .references(() => streams.id, { onDelete: 'cascade' }),
    songId: uuid('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('stream_songs_pk').on(table.streamId, table.songId),
    index('stream_songs_song_idx').on(table.songId),
  ],
)
