import 'server-only'

import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'

import { users } from '@/modules/identity/schema'
import { mediaAssets } from '@/modules/media/schema'
import { taggables, tags } from '@/modules/taxonomy/schema'
import { db, timestampParam } from '@/shared/db'
import type { PublicationStatus } from '@/shared/db/enums'

import { arrangements, arrangementSections, songs } from './schema'

import type { ArrangementInput, SectionInput, SongInput } from './editor-schema'

/**
 * Запись разборов.
 *
 * Вынесено из `repository.ts` намеренно: чтение — это девять запросов
 * с соединениями и подсчётами, запись — это три десятка коротких вставок
 * и обновлений. В одном файле они складываются в тысячу строк, где
 * невозможно быстро найти нужное.
 *
 * Правило то же: единственное место модуля, где есть SQL записи.
 * Ни проверок прав, ни бизнес-правил — только «положить в базу».
 */

/**
 * Свободный адрес для песни.
 *
 * Адрес строится из исполнителя и названия, но обязан быть уникальным:
 * в клубе легко окажется два разбора «Кукушки» — от «Кино» и от Полины
 * Гагариной. Занятые адреса получают числовой хвост.
 *
 * Считается заранее, а не ловится по ошибке уникальности: сообщение
 * «нарушение ограничения songs_slug_idx» куратору не поможет.
 */
export async function findFreeSlug(base: string, exceptSongId?: string): Promise<string> {
  const taken = await db
    .select({ slug: songs.slug })
    .from(songs)
    .where(
      and(
        sql`${songs.slug} = ${base} or ${songs.slug} like ${`${base}-%`}`,
        exceptSongId ? ne(songs.id, exceptSongId) : undefined,
      ),
    )

  if (taken.length === 0) return base

  const used = new Set(taken.map((row) => row.slug))
  if (!used.has(base)) return base

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`
    if (!used.has(candidate)) return candidate
  }

  // Тысяча разборов одной песни — это не реальность, а поломка
  return `${base}-${Date.now()}`
}

export async function insertSong(
  input: SongInput,
  slug: string,
  createdBy: string,
): Promise<string> {
  const id = uuidv7()

  await db.insert(songs).values({
    id,
    slug,
    title: input.title,
    artist: input.artist,
    album: input.album,
    year: input.year,
    description: input.description,
    tuning: input.tuning,
    capo: input.capo,
    tempoBpm: input.tempoBpm,
    musicKey: input.musicKey,
    // Черновик по умолчанию: ничего не публикуется случайно (PRD v0.1 §8.2)
    status: 'draft',
    createdBy,
  })

  return id
}

export async function updateSong(songId: string, input: SongInput, slug: string): Promise<void> {
  await db
    .update(songs)
    .set({
      slug,
      title: input.title,
      artist: input.artist,
      album: input.album,
      year: input.year,
      description: input.description,
      tuning: input.tuning,
      capo: input.capo,
      tempoBpm: input.tempoBpm,
      musicKey: input.musicKey,
      updatedAt: new Date(),
    })
    .where(eq(songs.id, songId))
}

export async function updateSongStatus(
  songId: string,
  status: PublicationStatus,
  publishedAt: Date | null,
): Promise<void> {
  await db
    .update(songs)
    .set({ status, publishedAt, updatedAt: new Date() })
    .where(eq(songs.id, songId))
}

/**
 * Метки песни задаются списком целиком.
 *
 * Не «добавить метку» и «убрать метку», а «вот теперь такие»: форма
 * присылает итоговый набор, и разбирать разницу на стороне браузера
 * значило бы однажды разойтись с тем, что в базе.
 */
export async function replaceSongTags(songId: string, tagIds: string[]): Promise<void> {
  await db
    .delete(taggables)
    .where(and(eq(taggables.entityType, 'song'), eq(taggables.entityId, songId)))

  if (tagIds.length === 0) return

  await db
    .insert(taggables)
    .values(tagIds.map((tagId) => ({ tagId, entityType: 'song' as const, entityId: songId })))
    .onConflictDoNothing()
}

export async function insertArrangement(
  songId: string,
  input: ArrangementInput,
  curatorId: string,
  orderIndex: number,
): Promise<string> {
  const id = uuidv7()

  await db.insert(arrangements).values({
    id,
    songId,
    level: input.level,
    title: input.title,
    summary: input.summary,
    estimatedMinutes: input.estimatedMinutes,
    curatorId,
    orderIndex,
    status: 'draft',
  })

  return id
}

export async function updateArrangement(
  arrangementId: string,
  input: ArrangementInput,
): Promise<void> {
  await db
    .update(arrangements)
    .set({
      level: input.level,
      title: input.title,
      summary: input.summary,
      estimatedMinutes: input.estimatedMinutes,
    })
    .where(eq(arrangements.id, arrangementId))
}

export async function updateArrangementStatus(
  arrangementId: string,
  status: PublicationStatus,
): Promise<void> {
  await db.update(arrangements).set({ status }).where(eq(arrangements.id, arrangementId))
}

/** Привязывает загруженный ролик к варианту разбора */
export async function updateArrangementVideo(
  arrangementId: string,
  videoAssetId: string | null,
): Promise<void> {
  await db.update(arrangements).set({ videoAssetId }).where(eq(arrangements.id, arrangementId))
}

export async function deleteArrangement(arrangementId: string): Promise<void> {
  await db.delete(arrangements).where(eq(arrangements.id, arrangementId))
}

export async function insertSections(
  arrangementId: string,
  titles: string[],
  startOrder: number,
): Promise<void> {
  if (titles.length === 0) return

  await db.insert(arrangementSections).values(
    titles.map((title, index) => ({
      id: uuidv7(),
      arrangementId,
      title,
      orderIndex: startOrder + index,
    })),
  )
}

export async function upsertSection(
  arrangementId: string,
  input: SectionInput,
  orderIndex: number,
): Promise<string> {
  if (input.id) {
    await db
      .update(arrangementSections)
      .set({
        title: input.title,
        description: input.description,
        videoStartSec: input.videoStartSec,
        videoEndSec: input.videoEndSec,
        orderIndex,
      })
      .where(eq(arrangementSections.id, input.id))

    return input.id
  }

  const id = uuidv7()

  await db.insert(arrangementSections).values({
    id,
    arrangementId,
    title: input.title,
    description: input.description,
    videoStartSec: input.videoStartSec,
    videoEndSec: input.videoEndSec,
    orderIndex,
  })

  return id
}

export async function deleteSection(sectionId: string): Promise<void> {
  await db.delete(arrangementSections).where(eq(arrangementSections.id, sectionId))
}

/**
 * Новый порядок частей одним заходом.
 *
 * Все обновления в одной транзакции: наполовину применённый порядок —
 * это две части с номером «3» и разбор, который участник читает
 * не в том порядке, в каком его собирали.
 */
export async function reorderSections(arrangementId: string, sectionIds: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [index, sectionId] of sectionIds.entries()) {
      await tx
        .update(arrangementSections)
        .set({ orderIndex: index })
        .where(
          and(
            eq(arrangementSections.id, sectionId),
            // Ограничение на разбор обязательно: без него присланный
            // чужой идентификатор переставил бы часть в чужом разборе
            eq(arrangementSections.arrangementId, arrangementId),
          ),
        )
    }
  })
}

/** Сколько уже есть вариантов — чтобы новый встал в конец */
export async function countArrangements(songId: string): Promise<number> {
  const rows = await db
    .select({ id: arrangements.id })
    .from(arrangements)
    .where(eq(arrangements.songId, songId))

  return rows.length
}

/** Кто куратор варианта: нужно для проверки области прав «только свой» */
/**
 * Вариант разбора в том виде, в каком его нужно знать перед изменением.
 *
 * Название песни приходит присоединением, а не вторым запросом: оно
 * нужно журналу действий при удалении варианта, и спрашивать его
 * отдельно значило бы ходить в базу дважды на каждое действие.
 */
export async function findArrangementOwner(arrangementId: string): Promise<{
  songId: string
  curatorId: string | null
  songLabel: string
  level: 'beginner' | 'intermediate' | 'advanced'
} | null> {
  const [row] = await db
    .select({
      songId: arrangements.songId,
      curatorId: arrangements.curatorId,
      songLabel: sql<string>`${songs.artist} || ' — ' || ${songs.title}`,
      level: arrangements.level,
    })
    .from(arrangements)
    .innerJoin(songs, eq(songs.id, arrangements.songId))
    .where(eq(arrangements.id, arrangementId))
    .limit(1)

  return row ?? null
}

/**
 * Песня в том виде, в каком её нужно знать перед изменением.
 *
 * Один запрос вместо двух: `createdBy` нужен проверке прав, название
 * и исполнитель — правилам публикации. Разделять их значило бы ходить
 * в базу дважды на каждое действие.
 */
export async function findSongForEditing(songId: string): Promise<{
  createdBy: string | null
  status: PublicationStatus
  slug: string
  title: string
  artist: string
} | null> {
  const [row] = await db
    .select({
      createdBy: songs.createdBy,
      status: songs.status,
      slug: songs.slug,
      title: songs.title,
      artist: songs.artist,
    })
    .from(songs)
    .where(eq(songs.id, songId))
    .limit(1)

  return row ?? null
}

/** Состояние вариантов — для проверки готовности к публикации */
export async function findArrangementsForPublication(
  songId: string,
): Promise<{ status: PublicationStatus; sectionCount: number }[]> {
  const rows = await db
    .select({ id: arrangements.id, status: arrangements.status })
    .from(arrangements)
    .where(eq(arrangements.songId, songId))
    .orderBy(asc(arrangements.orderIndex))

  if (rows.length === 0) return []

  const sections = await db
    .select({ arrangementId: arrangementSections.arrangementId })
    .from(arrangementSections)
    .where(
      inArray(
        arrangementSections.arrangementId,
        rows.map((row) => row.id),
      ),
    )

  const counts = new Map<string, number>()
  for (const section of sections) {
    counts.set(section.arrangementId, (counts.get(section.arrangementId) ?? 0) + 1)
  }

  return rows.map((row) => ({ status: row.status, sectionCount: counts.get(row.id) ?? 0 }))
}

/**
 * Список разборов для управления.
 *
 * Отдельно от каталога участника: здесь другие потребности. Куратору
 * нужны черновики, состояние публикации и «чьё это», а не обложки
 * и уровни. Попытка обслужить оба экрана одним запросом дала бы
 * выборку, где половина полей всегда лишняя.
 */
export async function findManagedSongs(filters: {
  status: PublicationStatus | null
  curatorId: string | null
  query: string | null
}): Promise<
  {
    id: string
    slug: string
    title: string
    artist: string
    status: PublicationStatus
    updatedAt: Date
    arrangementCount: number
    publishedArrangementCount: number
    curatorNames: string[]
  }[]
> {
  const conditions = [
    filters.status ? eq(songs.status, filters.status) : undefined,
    filters.query
      ? sql`(${songs.title} ilike ${`%${filters.query}%`} or ${songs.artist} ilike ${`%${filters.query}%`})`
      : undefined,
    filters.curatorId
      ? sql`exists (
          select 1 from ${arrangements}
          where ${arrangements.songId} = ${songs.id}
            and ${arrangements.curatorId} = ${filters.curatorId}
        )`
      : undefined,
  ].filter(Boolean)

  const rows = await db
    .select({
      id: songs.id,
      slug: songs.slug,
      title: songs.title,
      artist: songs.artist,
      status: songs.status,
      updatedAt: songs.updatedAt,
    })
    .from(songs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(songs.updatedAt))
    .limit(200)

  if (rows.length === 0) return []

  const songIds = rows.map((row) => row.id)

  const variants = await db
    .select({
      songId: arrangements.songId,
      status: arrangements.status,
      curatorName: users.displayName,
    })
    .from(arrangements)
    .leftJoin(users, eq(users.id, arrangements.curatorId))
    .where(inArray(arrangements.songId, songIds))

  return rows.map((row) => {
    const own = variants.filter((variant) => variant.songId === row.id)

    return {
      ...row,
      arrangementCount: own.length,
      publishedArrangementCount: own.filter((variant) => variant.status === 'published').length,
      curatorNames: [
        ...new Set(
          own.map((variant) => variant.curatorName).filter((name): name is string => !!name),
        ),
      ],
    }
  })
}

/**
 * Все метки для выбора в редакторе.
 *
 * Отдельно от фильтров каталога: там показываются только встречающиеся
 * метки, здесь нужны все, включая ни разу не использованные — иначе
 * новую метку невозможно поставить первому разбору.
 */
export async function findAllTagsForEditor(): Promise<
  { id: string; name: string; kind: 'genre' | 'technique' | 'mood' }[]
> {
  return db
    .select({ id: tags.id, name: tags.name, kind: tags.kind })
    .from(tags)
    .orderBy(asc(tags.kind), asc(tags.orderIndex), asc(tags.name))
}

/** Метки, уже поставленные песне */
export async function findSongTagIds(songId: string): Promise<string[]> {
  const rows = await db
    .select({ tagId: taggables.tagId })
    .from(taggables)
    .where(and(eq(taggables.entityType, 'song'), eq(taggables.entityId, songId)))

  return rows.map((row) => row.tagId)
}

/**
 * Разбор целиком для редактора.
 *
 * Отдельно от `findSongBySlug`: тот отдаёт готовый вид для участника —
 * с разрешённым воспроизведением, скрытыми черновиками и вычисленными
 * длительностями. Редактору нужно ровно обратное: сырые поля как они
 * лежат в базе, включая черновики и незаполненные таймкоды. Один запрос
 * на два таких разных потребителя обслуживал бы плохо обоих.
 */
export async function findSongForEditor(songId: string): Promise<{
  id: string
  slug: string
  title: string
  artist: string
  album: string | null
  year: number | null
  description: string | null
  tuning: string | null
  capo: number | null
  tempoBpm: number | null
  musicKey: string | null
  status: PublicationStatus
  tagIds: string[]
  arrangements: {
    id: string
    level: 'beginner' | 'intermediate' | 'advanced'
    title: string | null
    summary: string | null
    estimatedMinutes: number | null
    status: PublicationStatus
    curatorId: string | null
    videoAssetId: string | null
    videoExternalId: string | null
    sections: {
      id: string
      title: string
      description: string | null
      orderIndex: number
      videoStartSec: number | null
      videoEndSec: number | null
    }[]
  }[]
} | null> {
  const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1)
  if (!song) return null

  const variants = await db
    .select({
      id: arrangements.id,
      level: arrangements.level,
      title: arrangements.title,
      summary: arrangements.summary,
      estimatedMinutes: arrangements.estimatedMinutes,
      status: arrangements.status,
      curatorId: arrangements.curatorId,
      videoAssetId: arrangements.videoAssetId,
      videoExternalId: mediaAssets.externalId,
    })
    .from(arrangements)
    .leftJoin(mediaAssets, eq(mediaAssets.id, arrangements.videoAssetId))
    .where(eq(arrangements.songId, songId))
    .orderBy(asc(arrangements.orderIndex))

  const sections =
    variants.length === 0
      ? []
      : await db
          .select()
          .from(arrangementSections)
          .where(
            inArray(
              arrangementSections.arrangementId,
              variants.map((variant) => variant.id),
            ),
          )
          .orderBy(asc(arrangementSections.orderIndex))

  return {
    id: song.id,
    slug: song.slug,
    title: song.title,
    artist: song.artist,
    album: song.album,
    year: song.year,
    description: song.description,
    tuning: song.tuning,
    capo: song.capo,
    tempoBpm: song.tempoBpm,
    musicKey: song.musicKey,
    status: song.status,
    tagIds: await findSongTagIds(songId),
    arrangements: variants.map((variant) => ({
      ...variant,
      sections: sections
        .filter((section) => section.arrangementId === variant.id)
        .map((section) => ({
          id: section.id,
          title: section.title,
          description: section.description,
          orderIndex: section.orderIndex,
          videoStartSec: section.videoStartSec,
          videoEndSec: section.videoEndSec,
        })),
    })),
  }
}

// ─────────────────────────────────────────────────────────────────
// СВОДКА ДЛЯ ЭКРАНА «ОБЗОР» (шаг 9.7)
// ─────────────────────────────────────────────────────────────────

export type SongsOverviewRow = {
  publishedRecently: number
  draftCount: number
  staleDrafts: { id: string; title: string; artist: string; updatedAt: Date }[]
}

/**
 * Три числа и короткий список для обзора управления.
 *
 * Одним обращением к базе, а не тремя: экран открывают по нескольку раз
 * в день, и каждый лишний запрос здесь — это задержка, которую видно.
 *
 * «Залежавшийся» черновик — тот, которого не касались дольше срока
 * из `app.config.ts`. Именно он и есть повод показать список: черновик,
 * начатый вчера, — это работа в процессе, а начатый месяц назад —
 * забытый.
 */
export async function findSongsOverview(input: {
  publishedSince: Date
  staleBefore: Date
  limit: number
}): Promise<SongsOverviewRow> {
  const [counts, stale] = await Promise.all([
    db
      .select({
        publishedRecently: sql<number>`count(*) filter (
          where ${songs.status} = 'published' and ${songs.publishedAt} >= ${timestampParam(input.publishedSince)}
        )::int`,
        draftCount: sql<number>`count(*) filter (where ${songs.status} = 'draft')::int`,
      })
      .from(songs),

    db
      .select({
        id: songs.id,
        title: songs.title,
        artist: songs.artist,
        updatedAt: songs.updatedAt,
      })
      .from(songs)
      .where(
        and(
          eq(songs.status, 'draft'),
          sql`${songs.updatedAt} < ${timestampParam(input.staleBefore)}`,
        ),
      )
      .orderBy(asc(songs.updatedAt))
      .limit(input.limit),
  ])

  return {
    publishedRecently: counts[0]?.publishedRecently ?? 0,
    draftCount: counts[0]?.draftCount ?? 0,
    staleDrafts: stale,
  }
}
