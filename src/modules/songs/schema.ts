import { sql } from 'drizzle-orm'
import { customType, index, integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

import { skillLevelEnum, users } from '@/modules/identity/schema'
import { mediaAssets } from '@/modules/media/schema'
import { createdAt, primaryId, timestampTz, updatedAt } from '@/shared/db/columns'
import { publicationStatusEnum } from '@/shared/db/enums'

/**
 * Разборы песен — ядро платформы.
 *
 * ─────────────────────────────────────────────────────────────────
 * ТРИ УРОВНЯ, И ЭТО ГЛАВНОЕ РЕШЕНИЕ СХЕМЫ
 *
 *   песня          Nothing Else Matters, Metallica, строй E, 72 удара
 *     └ вариант    «Intermediate, акустика» — разбор от конкретного куратора
 *         └ часть  «Соло» — кусок с видео и таймкодами
 *
 * Напрашивающийся вариант — держать уровни колонками прямо в песне
 * (`beginner_video_id`, `intermediate_video_id`) — отвергнут. Он ломается
 * на первом же реальном случае: два разных разбора одного уровня
 * от разных кураторов, версия «на акустике» рядом с версией «фингерстайл»,
 * уровень, привязанный к своему куратору. Колонками это не выражается,
 * и каждый новый случай стоил бы миграции.
 *
 * Вариант как отдельная запись даёт всё это бесплатно и, что важнее,
 * позволяет привязать к уровню прогресс участника: человек проходит
 * не «песню», а конкретный разбор конкретного уровня.
 * ─────────────────────────────────────────────────────────────────
 */

/**
 * Тип для поискового вектора.
 *
 * Своей поддержки `tsvector` у нашего слоя работы с базой нет — тип
 * объявляется здесь. Читать эту колонку из приложения не нужно и не
 * планируется: она существует только для индекса.
 */
const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
})

export const songs = pgTable(
  'songs',
  {
    id: primaryId(),

    /** Адрес страницы: 'metallica-nothing-else-matters' */
    slug: text('slug').notNull(),

    title: text('title').notNull(),
    artist: text('artist').notNull(),
    album: text('album'),
    /** Год выхода песни — для порядка в каталоге и поиска «что-нибудь из 90-х» */
    year: integer('year'),

    coverAssetId: uuid('cover_asset_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),
    description: text('description'),

    /**
     * Свойства инструмента.
     *
     * Строй вынесен в колонку, а не в метки: по нему фильтруют иначе,
     * чем по жанру. Человек не хочет перестраивать гитару ради одной
     * песни — это не «интерес», а условие, при котором он вообще
     * возьмётся за разбор (PRD v0.1 §12, пункт 8).
     */
    tuning: text('tuning'),
    capo: integer('capo'),
    tempoBpm: integer('tempo_bpm'),
    musicKey: text('music_key'),

    status: publicationStatusEnum('status').notNull().default('draft'),
    /**
     * Когда песня опубликована — или будет опубликована.
     *
     * Одна колонка на оба случая: у запланированной публикации это
     * момент в будущем, у опубликованной — в прошлом. Что именно
     * происходит, говорит `status`; вторая колонка про то же самое
     * рано или поздно разошлась бы с первой.
     */
    publishedAt: timestampTz('published_at'),

    /**
     * Оценка популярности.
     *
     * Денормализация ради сортировки каталога: считать просмотры
     * на лету при каждом открытии списка — это соединение с таблицей
     * событий на сотнях тысяч строк ради порядка карточек.
     * Пересчитывается фоновой задачей (Этап 10).
     */
    popularityScore: integer('popularity_score').notNull().default(0),

    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),

    createdAt: createdAt(),
    updatedAt: updatedAt(),

    /**
     * Поисковый образ песни.
     *
     * ─────────────────────────────────────────────────────────────────
     * ВЫЧИСЛЯЕМАЯ КОЛОНКА, А НЕ ПОЛЕ, КОТОРОЕ МЫ ЗАПОЛНЯЕМ
     *
     * База пересобирает её сама при любом изменении названия,
     * исполнителя, альбома или описания. Забыть обновить поисковый
     * образ невозможно — это не наш код, а свойство колонки.
     *
     * Способ «обновлять в сервисе при сохранении» отвергнут: он
     * работает ровно до первой правки в обход сервиса — миграции
     * данных, исправления руками в базе, будущего массового
     * переименования. После такой правки поиск молча перестаёт
     * находить песню, и заметить это можно только случайно.
     *
     * Веса: A — название, B — исполнитель, C — альбом, D — описание.
     * Так «Metallica» в поле исполнителя не перебивает песню, у которой
     * это слово в названии.
     * ─────────────────────────────────────────────────────────────────
     */
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`setweight(to_tsvector('russian', coalesce(title, '')), 'A') ||
          setweight(to_tsvector('russian', coalesce(artist, '')), 'B') ||
          setweight(to_tsvector('russian', coalesce(album, '')), 'C') ||
          setweight(to_tsvector('russian', coalesce(description, '')), 'D')`,
    ),
  },
  (table) => [
    uniqueIndex('songs_slug_idx').on(table.slug),
    // Каталог всегда просит опубликованное, отсортированное по дате
    index('songs_status_published_idx').on(table.status, table.publishedAt),
    index('songs_artist_idx').on(table.artist),
    index('songs_popularity_idx').on(table.popularityScore),
    // Полнотекстовый поиск. GIN, а не GiST: читаем несравнимо чаще,
    // чем пишем, — а именно на это GIN и рассчитан
    index('songs_search_idx').using('gin', table.searchVector),
  ],
)

export const arrangements = pgTable(
  'arrangements',
  {
    id: primaryId(),
    songId: uuid('song_id')
      .notNull()
      .references(() => songs.id, { onDelete: 'cascade' }),

    /**
     * Уровень.
     *
     * Та же шкала, что и уровень игры в профиле участника: это позволяет
     * при первом входе показать человеку разбор ему по силам, не изобретая
     * сопоставление двух разных шкал.
     */
    level: skillLevelEnum('level').notNull(),

    /** Чем этот вариант отличается: «Акустика, бой» / «Электро, соло» */
    title: text('title'),
    curatorId: uuid('curator_id').references(() => users.id, { onDelete: 'set null' }),

    /** Что человек освоит, пройдя разбор. Показывается до начала */
    summary: text('summary'),
    estimatedMinutes: integer('estimated_minutes'),

    /**
     * Общее видео разбора.
     *
     * Куратор может залить одно видео на весь разбор и разметить части
     * таймкодами — так снимают чаще всего. Либо оставить это поле пустым
     * и дать каждой части своё видео. Оба способа поддерживаются;
     * какой применён, решает наличие видео у части.
     */
    videoAssetId: uuid('video_asset_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),

    orderIndex: integer('order_index').notNull().default(0),
    status: publicationStatusEnum('status').notNull().default('draft'),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('arrangements_song_idx').on(table.songId),
    index('arrangements_curator_idx').on(table.curatorId),
    index('arrangements_level_idx').on(table.level),
    /*
     * Уникальности по (песня, уровень) здесь намеренно НЕТ.
     * Два разбора одного уровня от разных кураторов — обычное дело,
     * и запрет на это был бы ровно тем ограничением, ради снятия
     * которого варианты и вынесены в отдельную таблицу.
     */
  ],
)

export const arrangementSections = pgTable(
  'arrangement_sections',
  {
    id: primaryId(),
    arrangementId: uuid('arrangement_id')
      .notNull()
      .references(() => arrangements.id, { onDelete: 'cascade' }),

    /** «Вступление», «Куплет», «Соло» */
    title: text('title').notNull(),
    description: text('description'),
    orderIndex: integer('order_index').notNull().default(0),

    /**
     * Своё видео части — ИЛИ отрезок общего видео разбора.
     *
     * Заполнено либо первое, либо пара таймкодов. Правило проверяется
     * в коде (`resolveSectionPlayback`), а не ограничением базы:
     * выразить «одно из двух» в PostgreSQL можно, но сообщение об ошибке
     * получит куратор, и оно будет на языке базы данных.
     */
    videoAssetId: uuid('video_asset_id').references(() => mediaAssets.id, {
      onDelete: 'set null',
    }),
    videoStartSec: integer('video_start_sec'),
    videoEndSec: integer('video_end_sec'),

    /** Длительность части. Показывается в списке до открытия */
    durationSec: integer('duration_sec'),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('arrangement_sections_arrangement_idx').on(table.arrangementId)],
)
