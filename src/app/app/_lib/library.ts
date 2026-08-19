import 'server-only'

import { getLessonRefs } from '@/modules/course/service'
import { favoriteKey } from '@/modules/library'
import type { FavoriteEntity, FavoriteRef, FavoriteRow } from '@/modules/library'
import { listFavorites } from '@/modules/library/service'
import { getSongsByIds } from '@/modules/songs/service'
import { getStreamLinks } from '@/modules/streams/service'
import type { ContentViewer } from '@/shared/content'
import { routes } from '@/shared/routes'

import { getContentViewer } from './viewer'

/**
 * Отложенное: превращение ссылок в то, на что можно нажать.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ЭТО ЖИВЁТ В СЛОЕ ПРИЛОЖЕНИЯ
 *
 * Библиотека знает только «вид и идентификатор» — она намеренно ничего
 * не знает о содержимом. Курс знает про уроки и не знает про эфиры.
 * Разборы знают про песни и не знают про курс.
 *
 * Свести их можно только здесь. Ровно тот же приём, что у кнопки
 * «Продолжить» (`resume.ts`), у материалов урока и у связанных эфиров:
 * слой приложения имеет право обращаться к любому модулю, модули друг
 * к другу — нет.
 * ─────────────────────────────────────────────────────────────────
 *
 * ЧТО СНЯТО С ПУБЛИКАЦИИ, ТО НЕ ПОКАЗЫВАЕТСЯ. Справки о содержимом
 * спрашиваются от имени смотрящего, и разбор, убранный в черновики,
 * из списка исчезает — не ломая строку в базе. Вернут его на место —
 * вернётся и карточка.
 */

/**
 * Право видеть черновики — своё в каждом разделе.
 *
 * Куратор разборов не обязан видеть черновики курса, и наоборот.
 * Один общий «читатель» на весь список показал бы ему и то, и другое:
 * права на разделы разные, а признак `canSeeDrafts` — один.
 *
 * Поэтому читателей три, по одному на раздел. Повторных вычислений это
 * не стоит: права за отрисовку страницы считаются один раз и кэшируются
 * внутри `getViewer`.
 */
export type LibraryViewers = Record<FavoriteEntity, ContentViewer>

/** Возвращает `null`, если человек не вошёл */
export async function getLibraryViewers(): Promise<LibraryViewers | null> {
  const [song, stream, lesson] = await Promise.all([
    getContentViewer('songs.view_drafts'),
    getContentViewer('streams.view_drafts'),
    getContentViewer('course.view_drafts'),
  ])

  if (!song || !stream || !lesson) return null

  return { song, stream, lesson }
}

export type LibraryCard = {
  entityType: FavoriteEntity
  entityId: string
  title: string
  subtitle: string
  href: string
  addedAt: Date
}

/**
 * Отложенное этим человеком, готовое к отрисовке.
 *
 * Порядок задаёт дата добавления и ничто больше: свежее сверху,
 * без раскладки по видам. Раскладку делает вкладка, и она не меняет
 * порядок внутри — иначе одна и та же вещь стояла бы в разных местах
 * в зависимости от того, откуда человек на неё смотрит.
 */
export async function findLibraryCards(viewers: LibraryViewers): Promise<LibraryCard[]> {
  const userId = viewers.song.userId
  if (!userId) return []

  const rows = await listFavorites(userId)
  if (rows.length === 0) return []

  const idsOf = (entityType: FavoriteEntity) =>
    rows.filter((row) => row.entityType === entityType).map((row) => row.entityId)

  const [songs, streams, lessons] = await Promise.all([
    getSongsByIds(viewers.song, idsOf('song')),
    getStreamLinks(viewers.stream, idsOf('stream')),
    getLessonRefs(viewers.lesson, idsOf('lesson')),
  ])

  const songById = new Map(songs.map((item) => [item.id, item]))
  const streamById = new Map(streams.map((item) => [item.id, item]))
  const lessonById = new Map(lessons.map((item) => [item.id, item]))

  const cards: LibraryCard[] = []

  for (const row of rows) {
    const card = toCard(row, songById, streamById, lessonById)
    if (card) cards.push(card)
  }

  return cards
}

function toCard(
  row: FavoriteRow,
  songs: Map<string, Awaited<ReturnType<typeof getSongsByIds>>[number]>,
  streams: Map<string, Awaited<ReturnType<typeof getStreamLinks>>[number]>,
  lessons: Map<string, Awaited<ReturnType<typeof getLessonRefs>>[number]>,
): LibraryCard | null {
  const base = { entityType: row.entityType, entityId: row.entityId, addedAt: row.createdAt }

  switch (row.entityType) {
    case 'song': {
      const song = songs.get(row.entityId)
      if (!song) return null

      return {
        ...base,
        title: song.title,
        subtitle: song.artist,
        // Ссылка ведёт на песню, а не на вариант разбора: уровень
        // страница выберет сама — по профилю или по последнему открытому
        href: routes.app.learn.song(song.slug),
      }
    }

    case 'stream': {
      const stream = streams.get(row.entityId)
      if (!stream) return null

      return {
        ...base,
        title: stream.title,
        subtitle: stream.curatorName ?? '',
        href: routes.app.streams.stream(stream.slug),
      }
    }

    case 'lesson': {
      const lesson = lessons.get(row.entityId)
      if (!lesson) return null

      return {
        ...base,
        title: lesson.title,
        subtitle: lesson.moduleTitle,
        href: routes.app.learn.lesson(lesson.moduleSlug, lesson.lessonSlug),
      }
    }
  }
}

/**
 * Существует ли объект и виден ли он этому человеку.
 *
 * Нужно перед тем, как что-то отложить: иначе в таблицу попадают
 * идентификаторы чужих черновиков, а сама кнопка превращается в способ
 * узнать, что готовится к публикации.
 *
 * Проверка стоит здесь, а не в модуле библиотеки, по той же причине,
 * по которой здесь стоит сборка карточек: спросить у разборов, курса
 * и эфиров сразу может только слой приложения.
 */
export async function isVisibleContent(
  viewers: LibraryViewers,
  ref: FavoriteRef,
): Promise<boolean> {
  switch (ref.entityType) {
    case 'song':
      return (await getSongsByIds(viewers.song, [ref.entityId])).length > 0
    case 'stream':
      return (await getStreamLinks(viewers.stream, [ref.entityId])).length > 0
    case 'lesson':
      return (await getLessonRefs(viewers.lesson, [ref.entityId])).length > 0
  }
}

/** Ключи отложенного — чтобы кнопка знала своё состояние без второго запроса */
export function libraryKeys(rows: FavoriteRef[]): Set<string> {
  return new Set(rows.map(favoriteKey))
}
