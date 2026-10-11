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
  isSlugTaken,
  searchNewsRows,
  setNewsPublished,
  updateNews,
} from './repository'

import type { ManageNewsRow, NewsCard, NewsPostView } from './types'

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

export async function getNewsCards(viewer: ContentViewer): Promise<NewsCard[]> {
  const rows = await findNewsCards(viewer.canSeeDrafts, appConfig.news.pageSize)

  return rows.map(toCard)
}

export async function getNewsBySlug(
  viewer: ContentViewer,
  slug: string,
): Promise<NewsPostView | null> {
  const row = await findNewsBySlug(slug, viewer.canSeeDrafts)
  if (!row) return null

  return {
    ...toCard(row),
    // Содержимое всегда проходит проверку: в JSON может лежать что
    // угодно, включая записанное прошлой версией приложения
    content: parseContentBlocks(row.content),
  }
}

function toCard(row: {
  id: string
  slug: string
  title: string
  excerpt: string | null
  authorName: string | null
  isPinned: boolean
  publishedAt: Date | null
  status: string
}): NewsCard {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    authorName: row.authorName,
    isPinned: row.isPinned,
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

  return rows.map((row) => ({ ...row, status: row.status }))
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
  patch: { title: string; excerpt: string | null; content: unknown; isPinned: boolean },
): Promise<void> {
  await requirePermission(actorId, 'news.edit')

  const title = patch.title.trim()
  if (!title) throw errors.validation({ title: 'Заголовок не может быть пустым' })

  await updateNews(id, {
    title,
    excerpt: patch.excerpt?.trim() || null,
    // Проверяем перед записью, а не только при чтении: в базу должно
    // попадать разобранное значение, иначе испорченный блок доживёт
    // до следующего чтения и там молча исчезнет
    content: parseContentBlocks(patch.content),
    isPinned: patch.isPinned,
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
