import { sql } from 'drizzle-orm'
import { boolean, customType, index, jsonb, pgEnum, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core' // prettier-ignore

import { users } from '@/modules/identity/schema'
import { createdAt, primaryId, timestampTz, updatedAt } from '@/shared/db/columns'
import { publicationStatusEnum } from '@/shared/db/enums'

import { NEWS_KINDS } from './types'

/** Тип для поискового вектора: см. пояснение в схеме разборов */
const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
})

/** Вид поста: дайджест, анонс, поздравление, новость. Перечень — в `types.ts` */
export const newsKindEnum = pgEnum('news_kind', NEWS_KINDS)

/**
 * Новости клуба.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЭТО НЕ БЛОГ И НЕ ЧАТ
 *
 * То же, что главная ветка чата клуба: дайджесты, анонсы, поздравления,
 * объявления (ADR-0032). Реакции есть — это один клик, — а комментариев
 * нет: живое общение в Telegram, и дублирование убило бы оба канала
 * (v0.1, приложение А). Под постом — кнопка «Обсудить в чате».
 * ─────────────────────────────────────────────────────────────────
 *
 * Содержимое — тот же блочный формат, что у уроков (`shared/blocks`).
 * Свой формат для новостей означал бы второй редактор, второй
 * отрисовщик и два разных набора возможностей у людей, пишущих
 * в одном и том же клубе.
 */
export const newsPosts = pgTable(
  'news_posts',
  {
    id: primaryId(),

    slug: text('slug').notNull(),
    title: text('title').notNull(),

    /**
     * Короткая выжимка для списка.
     *
     * Отдельным полем, а не первым абзацем содержимого: первый абзац
     * часто начинается с «Друзья, привет!», и список из десяти таких
     * приветствий не сообщает ничего.
     */
    excerpt: text('excerpt'),

    content: jsonb('content'),

    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),

    /**
     * Закреплённая новость показывается первой независимо от даты.
     *
     * Нужна ровно для одного: важное объявление не должно уезжать вниз
     * через неделю. Закреплённых может быть несколько — ограничивать
     * это в базе не за чем, порядок между ними задаёт дата.
     */
    isPinned: boolean('is_pinned').notNull().default(false),

    /**
     * До какого момента держать закреплённым. Пусто — пока не снимут.
     *
     * Анонс субботней встречи не должен висеть первым в понедельник:
     * дата снимает закрепление сама, без похода куратора в управление
     */
    pinnedUntil: timestampTz('pinned_until'),

    kind: newsKindEnum('kind').notNull().default('news'),

    /**
     * Ссылка на обсуждение в Telegram — сообщение в ветке чата.
     * Пусто — кнопка «Обсудить в чате» ведёт в первый чат из настроек
     */
    discussionUrl: text('discussion_url'),

    status: publicationStatusEnum('status').notNull().default('draft'),

    publishedAt: timestampTz('published_at'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),

    /**
     * Поисковый образ: название и выжимка.
     *
     * Содержимое лежит в JSON, и вытаскивать из него текст выражением
     * вычисляемой колонки — способ получить неотлаживаемое выражение.
     * То же решение, что у уроков.
     */
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`setweight(to_tsvector('russian', coalesce(title, '')), 'A') ||
          setweight(to_tsvector('russian', coalesce(excerpt, '')), 'B')`,
    ),
  },
  (table) => [
    uniqueIndex('news_posts_slug_idx').on(table.slug),
    // Единственный порядок ленты: закреплённые сверху, дальше по дате
    index('news_posts_published_idx').on(table.isPinned, table.publishedAt),
    index('news_posts_search_idx').using('gin', table.searchVector),
  ],
)
