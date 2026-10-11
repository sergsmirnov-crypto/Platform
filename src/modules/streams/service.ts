import 'server-only'

import { appConfig } from '@/shared/config/app.config'
import type { ContentViewer } from '@/shared/content'
import { errors } from '@/shared/errors'
import type { SearchQuery } from '@/shared/search'
import { formatTimecode } from '@/shared/utils/timecode'

import { canJoin, streamPhase } from './domain'
import {
  findArchive,
  findChapters,
  findStreamBySlug,
  findStreamCurators,
  findStreamMaterials,
  findStreamSongs,
  findStartingBetween,
  findStreamsByIds,
  findStreamsForSong,
  findUpcoming,
} from './repository'
import { searchStreamRows } from './search-repository'

import type { ArchiveFilters } from './archive-filters'
import type { StreamCuratorRow, StreamRow } from './repository'
import type { StreamHit } from './search-repository'
import type { StreamCard, StreamRef, StreamView } from './types'

/**
 * Сборка эфиров для показа.
 *
 * Состояние («скоро», «идёт», «запись») вычисляется здесь, а не хранится
 * в базе: оно зависит от текущего времени, и записанное значение
 * устаревает молча — через час после эфира база по-прежнему утверждала бы,
 * что он идёт.
 *
 * Текущее время передаётся одно на всю страницу. Иначе два эфира
 * в одном списке считались бы по разным часам, и на границе минуты
 * соседние карточки показывали бы «через 1 час» и «через 59 мин».
 */

function toCard(row: StreamRow, now: Date): StreamCard {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    startsAt: row.startsAt,
    phase: streamPhase(
      {
        state: row.state,
        startsAt: row.startsAt,
        endedAt: row.endedAt,
        hasVideo: row.videoAssetId !== null,
      },
      now,
    ),
    curatorId: row.curatorId,
    curatorName: row.curatorName,
    coverUrl: row.coverUrl,
    hasVideo: row.videoAssetId !== null,
    durationSec: row.durationSec,
    isDraft: row.status !== 'published',
  }
}

/** Ближайшие эфиры: анонсы и то, что идёт прямо сейчас */
export async function getUpcomingStreams(viewer: ContentViewer, limit = 5): Promise<StreamCard[]> {
  const now = new Date()
  const rows = await findUpcoming(viewer.canSeeDrafts, limit)

  return rows.map((row) => toCard(row, now))
}

/** Архив записей с постраничной навигацией и поиском */
export async function getStreamArchive(
  viewer: ContentViewer,
  filters: ArchiveFilters,
): Promise<{ items: StreamCard[]; total: number; page: number; pageCount: number }> {
  const now = new Date()
  const pageSize = appConfig.streams.archivePageSize

  const { items, total } = await findArchive({
    includeDrafts: viewer.canSeeDrafts,
    ...filters,
    pageSize,
  })

  return {
    items: items.map((row) => toCard(row, now)),
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}

/** Кураторы для отбора в архиве */
export async function getStreamCurators(viewer: ContentViewer): Promise<StreamCuratorRow[]> {
  return findStreamCurators(viewer.canSeeDrafts)
}

/** Страница эфира со всем содержимым */
export async function getStreamBySlug(viewer: ContentViewer, slug: string): Promise<StreamView> {
  const row = await findStreamBySlug(slug, viewer.canSeeDrafts)
  if (!row) throw errors.notFound('Эфир не найден')

  const now = new Date()
  const card = toCard(row, now)

  const [chapters, songs, materials] = await Promise.all([
    findChapters(row.id),
    findStreamSongs(row.id),
    findStreamMaterials(row.id),
  ])

  return {
    ...card,
    videoAssetId: row.videoAssetId,
    joinUrl: row.joinUrl,
    canJoin: canJoin({ joinUrl: row.joinUrl, startsAt: row.startsAt }, card.phase, now),
    // Подпись таймкода считается один раз на сервере: в браузере она
    // не меняется, и пересчитывать её при каждой отрисовке незачем
    chapters: chapters.map((chapter) => ({
      ...chapter,
      timecode: formatTimecode(chapter.startSec),
    })),
    songs,
    materials,
    endedAt: row.endedAt,
  }
}

/**
 * Ближайший эфир — один, для главной страницы.
 *
 * Отдельная функция, а не «взять первый из списка» на стороне страницы:
 * ограничение в один эфир должно доехать до базы, иначе главная будет
 * читать восемь строк ради одной.
 */
export async function getNextStream(viewer: ContentViewer): Promise<StreamCard | null> {
  const [next] = await getUpcomingStreams(viewer, 1)

  return next ?? null
}

/**
 * Справка об эфирах по идентификаторам — для кнопки «Продолжить».
 *
 * Прогресс знает только вид и идентификатор; название и адрес спрашивают
 * здесь. Записи без видео отсеиваются: продолжать в них нечего, а строка
 * прогресса могла остаться от эфира, чью запись потом сняли.
 */
export async function getStreamRefs(viewer: ContentViewer, ids: string[]): Promise<StreamRef[]> {
  const rows = await findStreamsByIds(ids, viewer.canSeeDrafts)

  return rows
    .filter((row) => row.videoAssetId !== null)
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      curatorName: row.curatorName,
    }))
}

/**
 * То же самое, но без требования записи — для отложенного (шаг 10.1).
 *
 * Отдельная функция, а не признак у предыдущей. Отсев записей — это
 * не настройка, а смысл: «Продолжить» предлагает досмотреть, и эфир
 * без записи там был бы ссылкой в никуда. Отложить же анонс совершенно
 * законно: человек увидел тему, отметил «хочу посмотреть» и вернётся
 * через неделю — уже к записи, по тому же адресу.
 *
 * Признак `includeUpcoming` вместо второй функции означал бы, что
 * однажды его передадут в «Продолжить» — и никто не заметит.
 */
export async function getStreamLinks(viewer: ContentViewer, ids: string[]): Promise<StreamRef[]> {
  const rows = await findStreamsByIds(ids, viewer.canSeeDrafts)

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    curatorName: row.curatorName,
  }))
}

/** Эфиры, в которых разбирали эту песню — для страницы разбора */
export async function getStreamsForSong(
  viewer: ContentViewer,
  songId: string,
): Promise<StreamCard[]> {
  const now = new Date()
  const rows = await findStreamsForSong(songId, viewer.canSeeDrafts)

  return rows.map((row) => toCard(row, now))
}

/**
 * Эфиры, начинающиеся в заданном окне — для напоминаний.
 *
 * Черновики не попадают: напоминать о том, чего участники не видят,
 * бессмысленно. Права не проверяются, потому что спрашивает фоновая
 * задача, у которой нет ни человека, ни сессии.
 */
export async function getStreamsStartingBetween(
  from: Date,
  until: Date,
): Promise<{ id: string; slug: string; title: string; startsAt: Date }[]> {
  const rows = await findStartingBetween(from, until)

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    startsAt: row.startsAt,
  }))
}

/** Эфиры, подходящие под запрос общей строки поиска (шаг 10.4) */
export async function searchStreams(
  viewer: ContentViewer,
  query: SearchQuery,
  limit: number,
): Promise<StreamHit[]> {
  return searchStreamRows(query, viewer.canSeeDrafts, limit)
}
