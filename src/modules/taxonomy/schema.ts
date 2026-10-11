import {
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import { createdAt, primaryId } from '@/shared/db/columns'
import { contentEntityEnum } from '@/shared/db/enums'

import { TAG_KINDS } from './catalog'

/**
 * Метки: жанры, техники, настроение.
 *
 * Отдельный модуль, а не часть разборов. Причина простая: метками будут
 * размечены и уроки курса, и записи эфиров. Живи они в модуле разборов —
 * курс и эфиры зависели бы от разборов ради жанра «русский рок»,
 * который к разборам не относится.
 *
 * Почему метки, а не колонки: набор жанров и техник меняется. «Слайд»
 * и «теппинг» появятся, когда куратор запишет первый такой разбор,
 * и добавление не должно быть миграцией базы.
 *
 * Почему строй — НЕ метка, а колонка песни: по нему фильтруют иначе.
 * Жанр — это интерес, а строй — условие: человек не станет перестраивать
 * гитару ради одной песни.
 */

/**
 * Вид метки.
 *
 * Разделение нужно интерфейсу: жанры показываются кнопками, техники —
 * списком, настроение — в подборках. Единый мешок «теги» превратил бы
 * фильтры каталога в одну длинную свалку из тридцати слов.
 */
export const tagKindEnum = pgEnum('tag_kind', TAG_KINDS)

export const tags = pgTable(
  'tags',
  {
    id: primaryId(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    kind: tagKindEnum('kind').notNull(),
    /** Порядок в списке фильтров: частые жанры выше редких */
    orderIndex: integer('order_index').notNull().default(0),

    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('tags_slug_idx').on(table.slug),
    index('tags_kind_idx').on(table.kind, table.orderIndex),
  ],
)

/**
 * Привязка метки к чему угодно.
 *
 * Полиморфная связь: внешнего ключа на объект здесь нет, потому что
 * объект может быть песней, уроком или эфиром. Плата за это — база
 * не помешает оставить метку от удалённого объекта.
 *
 * Альтернатива — по таблице связей на каждый вид содержимого
 * (`song_tags`, `lesson_tags`, `stream_tags`) — даёт целостность,
 * но превращает любой запрос «всё по метке» в объединение четырёх
 * таблиц, а добавление нового вида содержимого — в ещё одну таблицу
 * и ещё одну ветку в каждом запросе.
 *
 * Выбрана полиморфная связь; уборка осиротевших привязок — задача
 * удаляющего кода, а не базы.
 */
export const taggables = pgTable(
  'taggables',
  {
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    entityType: contentEntityEnum('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),

    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.tagId, table.entityType, table.entityId] }),
    // «Все метки этой песни» — самый частый запрос страницы
    index('taggables_entity_idx').on(table.entityType, table.entityId),
  ],
)
