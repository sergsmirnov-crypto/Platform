import 'server-only'

import { and, asc, count, desc, eq, gte, inArray, lt, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

import { users } from '@/modules/identity/schema'
import {
  canDownload,
  formatFileSize,
  isExternalKind,
  isReady,
  materialTitle,
} from '@/modules/media'
import type { MaterialView } from '@/modules/media'
import { attachments, mediaAssets } from '@/modules/media/schema'
import { songs } from '@/modules/songs/schema'
import { db } from '@/shared/db'

import { archiveOffset } from './archive-filters'
import { LIVE_GRACE_HOURS } from './domain'
import { streamChapters, streamSongs, streams } from './schema'

import type { StreamState } from './schema'

/**
 * Запросы к базе — единственное место в модуле, где есть SQL.
 *
 * Черновики отсекаются здесь, а не в сервисе: условие видимости должно
 * быть частью запроса, иначе однажды кто-нибудь отфильтрует их уже
 * после выборки, и черновик успеет уехать в браузер вместе с ответом.
 */

/**
 * Граница между «ближайшими» и «архивом».
 *
 * Идущий прямо сейчас эфир начался в прошлом, но место ему в ближайших.
 * Запас тот же, что в правилах показа: иначе список и карточка в нём
 * разошлись бы во мнении, закончился эфир или нет.
 */
const LIVE_GRACE_MS = LIVE_GRACE_HOURS * 60 * 60 * 1000

function visible(includeDrafts: boolean) {
  return includeDrafts ? undefined : eq(streams.status, 'published')
}

export type StreamRow = {
  id: string
  slug: string
  title: string
  description: string | null
  startsAt: Date
  endedAt: Date | null
  state: StreamState
  status: string
  joinUrl: string | null
  videoAssetId: string | null
  curatorId: string | null
  curatorName: string | null
  coverUrl: string | null
  durationSec: number | null
}

/**
 * Обложка и запись — оба ролика лежат в одном реестре медиа, поэтому
 * таблица присоединяется дважды под разными именами. Без псевдонима
 * база не поняла бы, к какому из двух относится колонка.
 */
const coverAssets = alias(mediaAssets, 'cover_assets')

/** Общий набор колонок: и списки, и страница показывают одно и то же */
const streamColumns = {
  id: streams.id,
  slug: streams.slug,
  title: streams.title,
  description: streams.description,
  startsAt: streams.startsAt,
  endedAt: streams.endedAt,
  state: streams.state,
  status: streams.status,
  joinUrl: streams.joinUrl,
  videoAssetId: streams.videoAssetId,
  curatorId: streams.curatorId,
  curatorName: users.displayName,
  coverUrl: coverAssets.url,
  durationSec: mediaAssets.durationSec,
}

function baseQuery() {
  return db
    .select(streamColumns)
    .from(streams)
    .leftJoin(users, eq(users.id, streams.curatorId))
    .leftJoin(mediaAssets, eq(mediaAssets.id, streams.videoAssetId))
    .leftJoin(coverAssets, eq(coverAssets.id, streams.coverAssetId))
}

/**
 * Ближайшие эфиры.
 *
 * Граница — не «дата больше сегодняшней», а «начало позже, чем три часа
 * назад»: идущий прямо сейчас эфир начался в прошлом, но место ему
 * в ближайших, а не в архиве. Три часа — тот же запас, что в правилах
 * `domain.ts`.
 */
export async function findUpcoming(includeDrafts: boolean, limit: number): Promise<StreamRow[]> {
  const since = new Date(Date.now() - LIVE_GRACE_MS)

  return baseQuery()
    .where(
      and(
        visible(includeDrafts),
        gte(streams.startsAt, since),
        // Отменённые в ближайших не показываем: они уже не состоятся,
        // а место в списке занимают
        or(eq(streams.state, 'scheduled'), eq(streams.state, 'live')),
      ),
    )
    .orderBy(asc(streams.startsAt))
    .limit(limit)
}

/**
 * Эфиры, начинающиеся в заданном окне. Нужно напоминаниям.
 *
 * Окно, а не «ближайшие сутки», намеренно: задача запускается раз в час,
 * и без окна один и тот же эфир попадал бы в выборку двадцать четыре
 * раза подряд. Ширина окна равна шагу расписания.
 */
export async function findStartingBetween(from: Date, until: Date): Promise<StreamRow[]> {
  return baseQuery()
    .where(
      and(
        visible(false),
        gte(streams.startsAt, from),
        lt(streams.startsAt, until),
        eq(streams.state, 'scheduled'),
      ),
    )
    .orderBy(asc(streams.startsAt))
}

export type ArchiveQuery = {
  includeDrafts: boolean
  query: string | null
  curatorId: string | null
  page: number
  pageSize: number
}

/**
 * Архив записей.
 *
 * Всё, что уже не в будущем, — включая эфиры, чья запись ещё готовится:
 * человек, пропустивший вчерашний эфир, должен увидеть, что он был,
 * а не решить, что эфира не случилось.
 */
export async function findArchive(
  input: ArchiveQuery,
): Promise<{ items: StreamRow[]; total: number }> {
  const since = new Date(Date.now() - LIVE_GRACE_MS)

  const conditions = [visible(input.includeDrafts), lt(streams.startsAt, since)]

  if (input.query) {
    // Тот же полнотекстовый поиск, что у разборов (ADR-0017), только
    // без исправления раскладки: тему эфира ищут точнее, чем песню
    conditions.push(sql`${streams.searchVector} @@ plainto_tsquery('russian', ${input.query})`)
  }

  if (input.curatorId) {
    conditions.push(eq(streams.curatorId, input.curatorId))
  }

  const where = and(...conditions)

  const [items, [counted]] = await Promise.all([
    baseQuery()
      .where(where)
      .orderBy(desc(streams.startsAt))
      .limit(input.pageSize)
      .offset(archiveOffset(input.page)),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(streams)
      .where(where),
  ])

  return { items, total: counted?.value ?? 0 }
}

export async function findStreamBySlug(
  slug: string,
  includeDrafts: boolean,
): Promise<StreamRow | null> {
  const [row] = await baseQuery()
    .where(and(eq(streams.slug, slug), visible(includeDrafts)))
    .limit(1)

  return row ?? null
}

export type ChapterRow = { id: string; title: string; startSec: number }

export async function findChapters(streamId: string): Promise<ChapterRow[]> {
  return db
    .select({
      id: streamChapters.id,
      title: streamChapters.title,
      startSec: streamChapters.startSec,
    })
    .from(streamChapters)
    .where(eq(streamChapters.streamId, streamId))
    .orderBy(asc(streamChapters.orderIndex), asc(streamChapters.startSec))
}

export type StreamSongRow = { id: string; slug: string; title: string; artist: string }

export async function findStreamSongs(streamId: string): Promise<StreamSongRow[]> {
  return db
    .select({
      id: songs.id,
      slug: songs.slug,
      title: songs.title,
      artist: songs.artist,
    })
    .from(streamSongs)
    .innerJoin(songs, eq(songs.id, streamSongs.songId))
    .where(and(eq(streamSongs.streamId, streamId), eq(songs.status, 'published')))
    .orderBy(asc(songs.title))
}

/**
 * Эфиры, в которых разбирали эту песню.
 *
 * Обратная сторона связи, и полезная: человек, застрявший на песне,
 * находит полтора часа живого разбора именно её.
 */
export async function findStreamsForSong(
  songId: string,
  includeDrafts: boolean,
  limit = 5,
): Promise<StreamRow[]> {
  const ids = await db
    .select({ streamId: streamSongs.streamId })
    .from(streamSongs)
    .where(eq(streamSongs.songId, songId))

  if (ids.length === 0) return []

  return baseQuery()
    .where(
      and(
        inArray(
          streams.id,
          ids.map((row) => row.streamId),
        ),
        visible(includeDrafts),
      ),
    )
    .orderBy(desc(streams.startsAt))
    .limit(limit)
}

/**
 * Кураторы, у которых есть записи в архиве.
 *
 * Отбор по учителю — самый естественный вход в архив для сообщества:
 * человек ищет не «эфир про баррэ», а «то, что вёл Иван». Список
 * собирается из данных, а не задаётся руками: куратор, ещё не проводивший
 * эфиров, в фильтре не появится, и человек не упрётся в пустую выдачу.
 */
export type StreamCuratorRow = { id: string; displayName: string; count: number }

export async function findStreamCurators(includeDrafts: boolean): Promise<StreamCuratorRow[]> {
  const since = new Date(Date.now() - LIVE_GRACE_MS)

  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      count: count(streams.id),
    })
    .from(streams)
    .innerJoin(users, eq(users.id, streams.curatorId))
    .where(and(visible(includeDrafts), lt(streams.startsAt, since)))
    .groupBy(users.id, users.displayName)
    .orderBy(asc(users.displayName))

  return rows
}

/**
 * Материалы эфира: конспект, ссылки, разобранные табы.
 *
 * Привязка полиморфная и общая для всей платформы — та же таблица держит
 * материалы разборов и уроков. Поэтому эфирам не понадобилось ни своей
 * таблицы, ни своей загрузки.
 */
export async function findStreamMaterials(streamId: string): Promise<MaterialView[]> {
  const rows = await db
    .select({
      id: attachments.id,
      title: attachments.title,
      mediaAssetId: mediaAssets.id,
      kind: mediaAssets.kind,
      assetTitle: mediaAssets.title,
      isDownloadable: mediaAssets.isDownloadable,
      sizeBytes: mediaAssets.sizeBytes,
      processingStatus: mediaAssets.processingStatus,
      url: mediaAssets.url,
    })
    .from(attachments)
    .innerJoin(mediaAssets, eq(mediaAssets.id, attachments.mediaAssetId))
    .where(and(eq(attachments.entityType, 'stream'), eq(attachments.entityId, streamId)))
    .orderBy(asc(attachments.orderIndex))

  return rows.map((row) => ({
    id: row.id,
    title: materialTitle(row.title ?? row.assetTitle, row.kind),
    kind: row.kind,
    mediaAssetId: row.mediaAssetId,
    isDownloadable: canDownload(row),
    sizeLabel: formatFileSize(row.sizeBytes),
    isReady: isReady(row.processingStatus),
    externalUrl: isExternalKind(row.kind) ? row.url : null,
  }))
}

/**
 * Эфиры по списку идентификаторов.
 *
 * Нужно кнопке «Продолжить»: прогресс хранит только вид и идентификатор,
 * а название и адрес приходится спрашивать у того модуля, которому
 * содержимое принадлежит.
 */
export async function findStreamsByIds(
  ids: string[],
  includeDrafts: boolean,
): Promise<StreamRow[]> {
  if (ids.length === 0) return []

  return baseQuery().where(and(inArray(streams.id, ids), visible(includeDrafts)))
}
