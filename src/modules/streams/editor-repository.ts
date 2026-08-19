import 'server-only'

import { and, asc, desc, eq, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'

import { userRoles } from '@/modules/access/schema'
import { users } from '@/modules/identity/schema'
import { mediaAssets } from '@/modules/media/schema'
import { songs } from '@/modules/songs/schema'
import { db, timestampParam } from '@/shared/db'
import type { PublicationStatus } from '@/shared/db/enums'

import { normalizeChapters } from './chapters'
import { streamChapters, streamSongs, streams } from './schema'

import type { ChapterDraft } from './chapters'
import type { StreamInput } from './editor-schema'
import type { StreamState } from './schema'

/**
 * Запросы редактора эфиров.
 *
 * Отдельно от `repository.ts`, который читает эфиры для участника:
 * там всё отфильтровано по видимости и собрано для показа, здесь —
 * запись и чтение без оглядки на статус. Смешать их значило бы однажды
 * случайно применить фильтр видимости к правке — и куратор перестал бы
 * находить собственный черновик.
 */

export type ManagedStreamRow = {
  id: string
  slug: string
  title: string
  startsAt: Date
  state: StreamState
  status: PublicationStatus
  curatorId: string | null
  curatorName: string | null
  hasVideo: boolean
  chapterCount: number
  updatedAt: Date
}

/**
 * Список для экрана управления.
 *
 * Сортировка по дате эфира, а не по времени правки, — в отличие
 * от разборов. Причина в природе содержимого: у эфира есть место
 * во времени, и куратор ищет «тот, что был на прошлой неделе»
 * или «тот, что в субботу». Сначала будущие, потом прошедшие
 * от новых к старым — то есть ровно так, как о них думают.
 */
export async function findManagedStreams(filters: {
  status: PublicationStatus | null
  state: StreamState | null
  curatorId: string | null
  query: string | null
}): Promise<ManagedStreamRow[]> {
  const conditions = []

  if (filters.status) conditions.push(eq(streams.status, filters.status))
  if (filters.state) conditions.push(eq(streams.state, filters.state))
  if (filters.curatorId) conditions.push(eq(streams.curatorId, filters.curatorId))

  if (filters.query) {
    const pattern = `%${filters.query}%`
    conditions.push(or(ilike(streams.title, pattern), ilike(streams.description, pattern)))
  }

  const rows = await db
    .select({
      id: streams.id,
      slug: streams.slug,
      title: streams.title,
      startsAt: streams.startsAt,
      state: streams.state,
      status: streams.status,
      curatorId: streams.curatorId,
      curatorName: users.displayName,
      videoAssetId: streams.videoAssetId,
      updatedAt: streams.updatedAt,
    })
    .from(streams)
    .leftJoin(users, eq(users.id, streams.curatorId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(streams.startsAt))

  const counts = await chapterCounts(rows.map((row) => row.id))

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    startsAt: row.startsAt,
    state: row.state,
    status: row.status,
    curatorId: row.curatorId,
    curatorName: row.curatorName,
    hasVideo: row.videoAssetId !== null,
    chapterCount: counts.get(row.id) ?? 0,
    updatedAt: row.updatedAt,
  }))
}

export type EditorStream = {
  id: string
  slug: string
  title: string
  description: string | null
  startsAt: Date
  state: StreamState
  status: PublicationStatus
  curatorId: string | null
  joinUrl: string | null
  videoAssetId: string | null
  videoExternalId: string | null
  createdBy: string | null
  chapters: { id: string; title: string; startSec: number }[]
  songIds: string[]
}

/** Эфир целиком для редактора: свойства, оглавление, связанные песни */
export async function findStreamForEditing(streamId: string): Promise<EditorStream | null> {
  const [row] = await db.select().from(streams).where(eq(streams.id, streamId)).limit(1)

  if (!row) return null

  const [chapters, linkedSongs, videoExternalId] = await Promise.all([
    db
      .select({
        id: streamChapters.id,
        title: streamChapters.title,
        startSec: streamChapters.startSec,
      })
      .from(streamChapters)
      .where(eq(streamChapters.streamId, streamId))
      .orderBy(asc(streamChapters.orderIndex)),

    db
      .select({ songId: streamSongs.songId })
      .from(streamSongs)
      .where(eq(streamSongs.streamId, streamId)),

    findVideoExternalId(row.videoAssetId),
  ])

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    startsAt: row.startsAt,
    state: row.state,
    status: row.status,
    curatorId: row.curatorId,
    joinUrl: row.joinUrl,
    videoAssetId: row.videoAssetId,
    videoExternalId,
    createdBy: row.createdBy,
    chapters,
    songIds: linkedSongs.map((item) => item.songId),
  }
}

/** Кто владелец — для области прав «только свой контент» */
export async function findStreamOwner(streamId: string): Promise<{
  curatorId: string | null
  createdBy: string | null
  slug: string
  /** Нужно журналу: после удаления эфира название взять будет неоткуда */
  title: string
  /** Нужно оповещению: «запись готова» без записи — худшее уведомление */
  videoAssetId: string | null
} | null> {
  const [row] = await db
    .select({
      curatorId: streams.curatorId,
      createdBy: streams.createdBy,
      slug: streams.slug,
      title: streams.title,
      videoAssetId: streams.videoAssetId,
    })
    .from(streams)
    .where(eq(streams.id, streamId))
    .limit(1)

  return row ?? null
}

export async function insertStream(input: {
  values: StreamInput
  slug: string
  createdBy: string
}): Promise<string> {
  const id = uuidv7()

  await db.insert(streams).values({
    id,
    slug: input.slug,
    title: input.values.title,
    description: input.values.description,
    curatorId: input.values.curatorId,
    startsAt: input.values.startsAt,
    joinUrl: input.values.joinUrl,
    // Всегда черновик и всегда «запланирован»: ничего не публикуется
    // случайно, и ни один эфир не начинается сам собой
    state: 'scheduled',
    status: 'draft',
    createdBy: input.createdBy,
  })

  return id
}

export async function updateStream(streamId: string, values: StreamInput): Promise<void> {
  await db
    .update(streams)
    .set({
      title: values.title,
      description: values.description,
      curatorId: values.curatorId,
      startsAt: values.startsAt,
      joinUrl: values.joinUrl,
      updatedAt: new Date(),
    })
    .where(eq(streams.id, streamId))
}

/**
 * Смена этапа жизни.
 *
 * Время окончания проставляется вместе с переходом в «запись»: оно
 * нужно только для отчётности и берётся не от куратора, а от часов —
 * заставлять его вписывать «во сколько закончилось» незачем.
 */
export async function updateStreamState(streamId: string, state: StreamState): Promise<void> {
  await db
    .update(streams)
    .set({
      state,
      endedAt: state === 'recorded' ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(streams.id, streamId))
}

export async function updateStreamStatus(
  streamId: string,
  status: PublicationStatus,
): Promise<void> {
  await db
    .update(streams)
    .set({
      status,
      publishedAt: status === 'published' ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(streams.id, streamId))
}

export async function updateStreamVideo(
  streamId: string,
  videoAssetId: string | null,
): Promise<void> {
  await db
    .update(streams)
    .set({ videoAssetId, updatedAt: new Date() })
    .where(eq(streams.id, streamId))
}

export async function deleteStreamRow(streamId: string): Promise<void> {
  // Оглавление и связи с песнями исчезают вместе с эфиром — это задано
  // внешними ключами в схеме, отдельных удалений не нужно
  await db.delete(streams).where(eq(streams.id, streamId))
}

/**
 * Замена оглавления целиком.
 *
 * Не «сравнить и обновить изменившееся»: пункты не имеют собственной
 * жизни — ни ссылок на них, ни прогресса по ним. Замена целиком короче
 * на полсотни строк и не может рассинхронизироваться.
 */
export async function replaceChapters(streamId: string, chapters: ChapterDraft[]): Promise<void> {
  const normalized = normalizeChapters(chapters)

  await db.delete(streamChapters).where(eq(streamChapters.streamId, streamId))

  if (normalized.length === 0) return

  await db.insert(streamChapters).values(
    normalized.map((chapter) => ({
      id: uuidv7(),
      streamId,
      title: chapter.title,
      startSec: chapter.startSec,
      orderIndex: chapter.orderIndex,
    })),
  )
}

/** Связь с песнями — по той же причине заменяется целиком */
export async function replaceStreamSongs(streamId: string, songIds: string[]): Promise<void> {
  await db.delete(streamSongs).where(eq(streamSongs.streamId, streamId))

  if (songIds.length === 0) return

  await db.insert(streamSongs).values(songIds.map((songId) => ({ streamId, songId })))
}

/**
 * Кого можно назначить ведущим.
 *
 * Все, у кого есть хоть какая-то роль, — то есть команда клуба.
 * Точнее отобрать нельзя: право вести эфир отдельным разрешением
 * не выражается, а спрашивать «есть ли у него streams.edit» значило бы
 * запретить назначать ведущим приглашённого гостя, которому карточку
 * заводит кто-то другой.
 *
 * Таблица ролей — чужая, из модуля прав. Это тот самый задокументированный
 * случай: внешние ключи между таблицами по природе пересекают границы
 * модулей (ARCHITECTURE §3).
 */
export type CuratorOption = { id: string; displayName: string }

export async function findCuratorOptions(): Promise<CuratorOption[]> {
  const rows = await db
    .selectDistinct({ id: users.id, displayName: users.displayName })
    .from(userRoles)
    .innerJoin(users, eq(users.id, userRoles.userId))
    .orderBy(asc(users.displayName))

  return rows
}

export type SongOption = { id: string; title: string; artist: string }

/**
 * Песни для связывания.
 *
 * Поиск, а не полный список: разборов двести, и выпадающий список
 * из двухсот строк на телефоне бесполезен. Черновики попадают в выдачу —
 * эфир и разбор часто готовятся вместе.
 */
export async function findSongOptions(query: string | null, limit = 20): Promise<SongOption[]> {
  const pattern = query ? `%${query}%` : null

  return db
    .select({ id: songs.id, title: songs.title, artist: songs.artist })
    .from(songs)
    .where(pattern ? or(ilike(songs.title, pattern), ilike(songs.artist, pattern)) : undefined)
    .orderBy(asc(songs.title))
    .limit(limit)
}

/** Названия уже связанных песен — чтобы показать их без второго поиска */
export async function findSongsByIds(ids: string[]): Promise<SongOption[]> {
  if (ids.length === 0) return []

  return db
    .select({ id: songs.id, title: songs.title, artist: songs.artist })
    .from(songs)
    .where(inArray(songs.id, ids))
    .orderBy(asc(songs.title))
}

/** Занят ли адрес другим эфиром */
export async function slugTaken(slug: string, exceptId: string | null = null): Promise<boolean> {
  const rows = await db
    .select({ id: streams.id })
    .from(streams)
    .where(eq(streams.slug, slug))
    .limit(1)

  const found = rows[0]

  return found !== undefined && found.id !== exceptId
}

async function chapterCounts(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map()

  const rows = await db
    .select({ streamId: streamChapters.streamId, id: streamChapters.id })
    .from(streamChapters)
    .where(inArray(streamChapters.streamId, ids))

  const counts = new Map<string, number>()

  for (const row of rows) {
    counts.set(row.streamId, (counts.get(row.streamId) ?? 0) + 1)
  }

  return counts
}

/**
 * Идентификатор ролика у видеохостинга.
 *
 * Нужен редактору, чтобы показать в поле то же значение, которое куратор
 * туда вписал. Без этого поле после сохранения выглядело бы пустым,
 * и куратор вписал бы ролик второй раз.
 */
async function findVideoExternalId(assetId: string | null): Promise<string | null> {
  if (!assetId) return null

  const [row] = await db
    .select({ externalId: mediaAssets.externalId })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, assetId))
    .limit(1)

  return row?.externalId ?? null
}

// ─────────────────────────────────────────────────────────────────
// СВОДКА ДЛЯ ЭКРАНА «ОБЗОР» (шаг 9.7)
// ─────────────────────────────────────────────────────────────────

export type StreamsOverviewRow = {
  publishedRecently: number
  /** Эфир прошёл, а записи к нему так и не привязали */
  missingRecordings: { id: string; title: string; startsAt: Date }[]
}

/**
 * Сводка по эфирам.
 *
 * Главное здесь — не счётчики, а эфиры без записи. Это единственная
 * забота, которая сама о себе не напомнит: анонс на месте, дата прошла,
 * участники ждут запись, и заметить это можно, только если специально
 * пойти смотреть. Отменённые не в счёт — у них записи и не должно быть.
 */
export async function findStreamsOverview(input: {
  publishedSince: Date
  now: Date
  limit: number
}): Promise<StreamsOverviewRow> {
  const [counts, missing] = await Promise.all([
    db
      .select({
        publishedRecently: sql<number>`count(*) filter (
          where ${streams.status} = 'published' and ${streams.publishedAt} >= ${timestampParam(input.publishedSince)}
        )::int`,
      })
      .from(streams),

    db
      .select({ id: streams.id, title: streams.title, startsAt: streams.startsAt })
      .from(streams)
      .where(
        and(
          sql`${streams.startsAt} < ${timestampParam(input.now)}`,
          isNull(streams.videoAssetId),
          ne(streams.state, 'cancelled'),
        ),
      )
      .orderBy(desc(streams.startsAt))
      .limit(input.limit),
  ])

  return {
    publishedRecently: counts[0]?.publishedRecently ?? 0,
    missingRecordings: missing,
  }
}
