import 'server-only'

import { requirePermission } from '@/modules/access'
import { parseContentBlocks } from '@/shared/blocks'
import { appConfig } from '@/shared/config/app.config'
import type { ContentViewer } from '@/shared/content'
import { errors } from '@/shared/errors'
import type { SearchQuery } from '@/shared/search'
import { slugify } from '@/shared/utils/slug'

import {
  deleteNews,
  findNewsById,
  findNewsBySlug,
  findNewsCards,
  findNewsForManage,
  insertNews,
  isNewsVisible,
  isSlugTaken,
  searchNewsRows,
  setNewsPublished,
  updateNews,
} from './repository'
import { isPinnedNow, isValidDiscussionUrl } from './rules'

import type { ManageNewsRow, NewsCard, NewsKind, NewsPostView } from './types'

/**
 * Новости клуба: чтение и правка.
 *
 * ⚠️ Каждая изменяющая функция начинается с `requirePermission` — как
 * в редакторе разборов. Это не перестраховка: до сервиса можно дойти
 * путями, которые не проходят через страницу управления.
 *
 * Область действия у прав на новости не бывает `own`: новость пишут
 * от лица клуба, а не от своего, и делить их на «мои» и «чужие»
 * значило бы делить сам клуб.
 *
 * Чтение прав не требует: черновики отсекаются признаком читателя,
 * а не отдельной проверкой — так забыть их спрятать невозможно.
 */

/**
 * Лента постов.
 *
 * @param options.kind  только этот вид; по умолчанию — все
 * @param options.limit сколько показать; по умолчанию — страница ленты
 */
export async function getNewsCards(
  viewer: ContentViewer,
  options: { kind?: NewsKind | null; limit?: number } = {},
): Promise<NewsCard[]> {
  const rows = await findNewsCards(
    viewer.canSeeDrafts,
    options.limit ?? appConfig.news.pageSize,
    options.kind ?? null,
  )
  const now = new Date()

  return rows.map((row) => toCard(row, now))
}

/** Виден ли пост этому человеку. Нужен перед реакцией: см. слой приложения */
export async function canSeeNews(viewer: ContentViewer, id: string): Promise<boolean> {
  return isNewsVisible(id, viewer.canSeeDrafts)
}

export async function getNewsBySlug(
  viewer: ContentViewer,
  slug: string,
): Promise<NewsPostView | null> {
  const row = await findNewsBySlug(slug, viewer.canSeeDrafts)
  if (!row) return null

  return {
    ...toCard(row, new Date()),
    discussionUrl: row.discussionUrl,
    // Содержимое всегда проходит проверку: в JSON может лежать что
    // угодно, включая записанное прошлой версией приложения
    content: parseContentBlocks(row.content),
  }
}

function toCard(
  row: {
    id: string
    slug: string
    title: string
    excerpt: string | null
    authorName: string | null
    kind: NewsKind
    isPinned: boolean
    pinnedUntil: Date | null
    publishedAt: Date | null
    status: string
  },
  now: Date,
): NewsCard {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    authorName: row.authorName,
    kind: row.kind,
    isPinned: isPinnedNow(row.isPinned, row.pinnedUntil, now),
    publishedAt: row.publishedAt,
    isDraft: row.status !== 'published',
  }
}

/** Новости, подходящие под запрос общей строки поиска */
export async function searchNews(viewer: ContentViewer, query: SearchQuery, limit: number) {
  return searchNewsRows(query, viewer.canSeeDrafts, limit)
}

// ─── Управление ───

export async function listNewsForManage(): Promise<ManageNewsRow[]> {
  const rows = await findNewsForManage()
  const now = new Date()

  return rows.map(({ pinnedUntil, ...row }) => ({
    ...row,
    isPinned: isPinnedNow(row.isPinned, pinnedUntil, now),
  }))
}

export async function getNewsForEditor(id: string) {
  const row = await findNewsById(id)
  if (!row) throw errors.notFound('Новость не найдена')

  return { ...row, content: parseContentBlocks(row.content) }
}

/**
 * Создание.
 *
 * Пустая новость с временным заголовком, а не форма «сначала заполните».
 * Так работает создание разбора и эфира: человек попадает в редактор
 * и правит то, что видит, вместо того чтобы угадывать поля заранее.
 */
export async function createNews(actorId: string, title: string): Promise<string> {
  await requirePermission(actorId, 'news.create')

  const clean = title.trim() || 'Без заголовка'

  return insertNews({
    slug: await uniqueSlug(clean, null),
    title: clean,
    authorId: actorId,
    createdBy: actorId,
  })
}

export async function saveNews(
  actorId: string,
  id: string,
  patch: {
    title: string
    excerpt: string | null
    content: unknown
    isPinned: boolean
    pinnedUntil: Date | null
    kind: NewsKind
    discussionUrl: string | null
  },
): Promise<void> {
  await requirePermission(actorId, 'news.edit')

  const title = patch.title.trim()
  if (!title) throw errors.validation({ title: 'Заголовок не может быть пустым' })

  const discussionUrl = patch.discussionUrl?.trim() || null
  if (discussionUrl && !isValidDiscussionUrl(discussionUrl)) {
    throw errors.validation({
      discussionUrl: 'Нужна ссылка на сообщение в Telegram: https://t.me/…',
    })
  }

  await updateNews(id, {
    title,
    excerpt: patch.excerpt?.trim() || null,
    // Проверяем перед записью, а не только при чтении: в базу должно
    // попадать разобранное значение, иначе испорченный блок доживёт
    // до следующего чтения и там молча исчезнет
    content: parseContentBlocks(patch.content),
    isPinned: patch.isPinned,
    // Срок без закрепления бессмыслен — не храним, чтобы не путать
    pinnedUntil: patch.isPinned ? patch.pinnedUntil : null,
    kind: patch.kind,
    discussionUrl,
  })
}

export async function publishNews(actorId: string, id: string, published: boolean): Promise<void> {
  await requirePermission(actorId, 'news.publish')

  await setNewsPublished(id, published)
}

export async function removeNews(actorId: string, id: string): Promise<void> {
  await requirePermission(actorId, 'news.delete')

  await deleteNews(id)
}

/**
 * Адрес новости.
 *
 * Строится из заголовка один раз, при создании, и дальше не меняется
 * сам: адрес опубликованной новости уже разослан в Telegram, и менять
 * его при правке опечатки в заголовке — значит ломать ссылку.
 */
async function uniqueSlug(title: string, exceptId: string | null): Promise<string> {
  const base = slugify(title) || 'novost'

  for (let suffix = 0; suffix < 50; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`

    if (!(await isSlugTaken(candidate, exceptId))) return candidate
  }

  // Пятьдесят новостей с одинаковым заголовком — это не совпадение,
  // а что-то другое. Дальше подставляем время
  return `${base}-${Date.now()}`
}
