import 'server-only'

import { and, asc, count, desc, eq, ilike, inArray, isNotNull, lte, ne, or, sql } from 'drizzle-orm'

import { avatarUrlFor } from '@/modules/identity'
import { users } from '@/modules/identity/schema'
import {
  canDownload,
  formatFileSize,
  isExternalKind,
  isReady,
  materialTitle,
} from '@/modules/media'
import { attachments, mediaAssets } from '@/modules/media/schema'
import { tags, taggables } from '@/modules/taxonomy/schema'
import { appConfig } from '@/shared/config/app.config'
import { db } from '@/shared/db'
import { hasSearch, parseSearchQuery, similarityInputs } from '@/shared/search'

import { pageOffset } from './catalog-filters'
import { compareLevels, resolveSectionPlayback, sectionDuration, tuningLabel } from './domain'
import { arrangements, arrangementSections, songs } from './schema'

import type { CatalogFilters } from './catalog-filters'
import type { Level } from './domain'
import type {
  ArrangementView,
  CatalogPage,
  MaterialView,
  SongSuggestion,
  SectionView,
  SongCard,
  SongView,
} from './types'

/**
 * Запросы к базе, связанные с разборами.
 *
 * Единственное место модуля, где есть SQL. Наружу отдаются готовые
 * структуры из `types.ts`, а не строки таблиц: интерфейс не должен знать
 * ни имён колонок, ни того, что уровни лежат в отдельной таблице.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПРО ВИДИМОСТЬ
 *
 * Условие «показывать только опубликованное» повторяется в каждом
 * запросе, и забыть его — значит показать участникам черновики.
 * Поэтому оно собрано одной функцией `visibilityCondition`, а решение
 * «можно ли видеть черновики» принимает сервис по правам, а не запрос.
 * ─────────────────────────────────────────────────────────────────
 */

/**
 * Условие видимости.
 *
 * Запланированная публикация открывается сама, по времени: сравнение
 * с текущим моментом делает база, чтобы разбор не ждал захода куратора.
 */
function visibilityCondition(includeDrafts: boolean) {
  if (includeDrafts) return undefined

  return or(
    eq(songs.status, 'published'),
    and(
      eq(songs.status, 'scheduled'),
      isNotNull(songs.publishedAt),
      lte(songs.publishedAt, sql`now()`),
    ),
  )
}

function isPublicRow(status: string, publishedAt: Date | null, now: Date): boolean {
  if (status === 'published') return true

  return status === 'scheduled' && publishedAt !== null && publishedAt <= now
}

/**
 * Оценка совпадения с запросом.
 *
 * `ts_rank_cd` учитывает и веса полей (название важнее исполнителя),
 * и близость слов друг к другу. Популярность добавляется как разрешение
 * ничьих: при равном совпадении выше идёт то, что чаще открывают.
 */
function relevanceExpression(tsquery: string) {
  return sql<number>`ts_rank_cd(${songs.searchVector}, to_tsquery('russian', ${tsquery}))`
}

function orderFor(sort: CatalogFilters['sort'], tsquery: string | null) {
  if (sort === 'relevance' && tsquery) {
    return [
      desc(relevanceExpression(tsquery)),
      desc(songs.popularityScore),
      desc(songs.publishedAt),
    ]
  }

  switch (sort) {
    case 'popular':
      return [desc(songs.popularityScore), desc(songs.publishedAt)]
    case 'alphabet':
      return [asc(songs.artist), asc(songs.title)]
    case 'level':
      // Порядок по уровню собирается в приложении: у песни несколько
      // уровней сразу, и «самый простой из имеющихся» база одной
      // колонкой не отсортирует
      return [asc(songs.artist), asc(songs.title)]
    default:
      return [desc(songs.publishedAt), desc(songs.createdAt)]
  }
}

/**
 * Каталог разборов.
 *
 * Два запроса вместо одного: сначала страница песен, потом их варианты.
 * Соединение одним запросом дало бы по строке на каждый вариант, и
 * «двадцать четыре песни на странице» превратилось бы в непредсказуемое
 * число строк — постраничная навигация сломалась бы.
 */
export async function findCatalogPage(filters: CatalogFilters): Promise<CatalogPage> {
  const pageSize = appConfig.catalog.pageSize
  const now = new Date()

  const conditions = [visibilityCondition(filters.includeDrafts)]

  const search = parseSearchQuery(filters.query)
  const searching = hasSearch(search)

  if (searching) {
    conditions.push(
      or(
        sql`${songs.searchVector} @@ to_tsquery('russian', ${search.tsquery})`,
        // Метку человек напечатает в поиск, а не пойдёт искать в фильтрах:
        // «фингерстайл» — это запрос, а не настройка
        sql`exists (
          select 1 from ${taggables}
          join ${tags} on ${tags.id} = ${taggables.tagId}
          where ${taggables.entityType} = 'song'
            and ${taggables.entityId} = ${songs.id}
            and ${tags.name} ilike ${'%' + search.terms.join(' ') + '%'}
        )`,
      ),
    )
  }

  if (filters.tunings.length > 0) {
    conditions.push(inArray(songs.tuning, filters.tunings))
  }

  if (filters.tags.length > 0) {
    conditions.push(
      sql`exists (
        select 1 from ${taggables}
        join ${tags} on ${tags.id} = ${taggables.tagId}
        where ${taggables.entityType} = 'song'
          and ${taggables.entityId} = ${songs.id}
          and ${tags.slug} in ${filters.tags}
      )`,
    )
  }

  // Уровень и куратор — свойства варианта, а не песни. Поэтому условие
  // формулируется как «у песни есть подходящий вариант»
  if (filters.levels.length > 0 || filters.curatorId || filters.maxMinutes) {
    const inner = [eq(arrangements.songId, songs.id)]

    if (filters.levels.length > 0) {
      inner.push(inArray(arrangements.level, filters.levels))
    }
    if (filters.curatorId) {
      inner.push(eq(arrangements.curatorId, filters.curatorId))
    }
    if (filters.maxMinutes) {
      inner.push(lte(arrangements.estimatedMinutes, filters.maxMinutes))
    }

    conditions.push(sql`exists (select 1 from ${arrangements} where ${and(...inner)})`)
  }

  const where = and(...conditions.filter(Boolean))

  const [totalRow] = await db.select({ value: count() }).from(songs).where(where)
  const total = totalRow?.value ?? 0

  const rows = await db
    .select({
      id: songs.id,
      slug: songs.slug,
      title: songs.title,
      artist: songs.artist,
      year: songs.year,
      tuning: songs.tuning,
      status: songs.status,
      publishedAt: songs.publishedAt,
      coverUrl: mediaAssets.url,
    })
    .from(songs)
    .leftJoin(mediaAssets, eq(mediaAssets.id, songs.coverAssetId))
    .where(where)
    .orderBy(...orderFor(filters.sort, searching ? search.tsquery : null))
    .limit(pageSize)
    .offset(pageOffset(filters.page, pageSize))

  const levelsBySong = await findLevelsForSongs(rows.map((row) => row.id))

  const items: SongCard[] = rows.map((row) => {
    const levels = levelsBySong.get(row.id) ?? []

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      artist: row.artist,
      year: row.year,
      coverUrl: row.coverUrl,
      tuning: row.tuning,
      tuningLabel: tuningLabel(row.tuning),
      levels,
      arrangementCount: levels.length,
      status: row.status,
      publishedAt: row.publishedAt,
      isPublic: isPublicRow(row.status, row.publishedAt, now),
    }
  })

  if (filters.sort === 'level') {
    items.sort((a, b) => {
      const first = a.levels[0]
      const second = b.levels[0]

      if (!first) return 1
      if (!second) return -1

      return compareLevels(first, second)
    })
  }

  return {
    items,
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  }
}

/** Какие уровни разобраны у каждой песни — для бейджей на карточках */
async function findLevelsForSongs(songIds: string[]): Promise<Map<string, Level[]>> {
  const result = new Map<string, Level[]>()
  if (songIds.length === 0) return result

  const rows = await db
    .select({ songId: arrangements.songId, level: arrangements.level })
    .from(arrangements)
    .where(inArray(arrangements.songId, songIds))

  for (const row of rows) {
    const existing = result.get(row.songId) ?? []
    if (!existing.includes(row.level)) existing.push(row.level)
    result.set(row.songId, existing)
  }

  for (const levels of result.values()) levels.sort(compareLevels)

  return result
}

/**
 * Страница песни целиком.
 *
 * Собирается четырьмя запросами: песня, варианты, части, материалы
 * и метки. Можно было бы одним с соединениями — и получить произведение
 * строк, которое потом всё равно пришлось бы разбирать в приложении,
 * только уже вслепую.
 */
export async function findSongBySlug(
  slug: string,
  includeDrafts: boolean,
): Promise<SongView | null> {
  const now = new Date()

  const [song] = await db
    .select({
      id: songs.id,
      slug: songs.slug,
      title: songs.title,
      artist: songs.artist,
      album: songs.album,
      year: songs.year,
      description: songs.description,
      tuning: songs.tuning,
      capo: songs.capo,
      tempoBpm: songs.tempoBpm,
      musicKey: songs.musicKey,
      status: songs.status,
      publishedAt: songs.publishedAt,
      coverUrl: mediaAssets.url,
    })
    .from(songs)
    .leftJoin(mediaAssets, eq(mediaAssets.id, songs.coverAssetId))
    .where(and(eq(songs.slug, slug), visibilityCondition(includeDrafts)))
    .limit(1)

  if (!song) return null

  const [arrangementViews, songTags, songMaterials] = await Promise.all([
    findArrangements(song.id, includeDrafts),
    findTags(song.id),
    findMaterials('song', [song.id]),
  ])

  return {
    ...song,
    tuningLabel: tuningLabel(song.tuning),
    isPublic: isPublicRow(song.status, song.publishedAt, now),
    tags: songTags,
    arrangements: arrangementViews,
    materials: songMaterials.get(song.id) ?? [],
  }
}

async function findArrangements(
  songId: string,
  includeDrafts: boolean,
): Promise<ArrangementView[]> {
  const rows = await db
    .select({
      id: arrangements.id,
      level: arrangements.level,
      title: arrangements.title,
      summary: arrangements.summary,
      estimatedMinutes: arrangements.estimatedMinutes,
      status: arrangements.status,
      orderIndex: arrangements.orderIndex,
      videoAssetId: arrangements.videoAssetId,
      curatorId: users.id,
      curatorName: users.displayName,
      curatorAvatarId: users.avatarId,
    })
    .from(arrangements)
    .leftJoin(users, eq(users.id, arrangements.curatorId))
    .where(eq(arrangements.songId, songId))
    .orderBy(asc(arrangements.orderIndex))

  const visible = includeDrafts ? rows : rows.filter((row) => row.status === 'published')
  if (visible.length === 0) return []

  const ids = visible.map((row) => row.id)

  const [sectionRows, materialsByArrangement] = await Promise.all([
    db
      .select()
      .from(arrangementSections)
      .where(inArray(arrangementSections.arrangementId, ids))
      .orderBy(asc(arrangementSections.orderIndex)),
    findMaterials('arrangement', ids),
  ])

  return visible
    .map((row) => {
      const own = sectionRows.filter((section) => section.arrangementId === row.id)

      const sections: SectionView[] = own.map((section) => ({
        id: section.id,
        title: section.title,
        description: section.description,
        orderIndex: section.orderIndex,
        durationSec: sectionDuration(section),
        playback: resolveSectionPlayback(section, row.videoAssetId),
      }))

      return {
        id: row.id,
        level: row.level,
        title: row.title,
        summary: row.summary,
        estimatedMinutes: row.estimatedMinutes,
        status: row.status,
        isPublic: row.status === 'published',
        curator: row.curatorId
          ? {
              id: row.curatorId,
              displayName: row.curatorName ?? 'Куратор',
              // Адрес фотографии собирает модуль участников: как именно
              // он устроен, разборам знать незачем
              avatarUrl: avatarUrlFor(row.curatorId, row.curatorAvatarId, 'sm'),
            }
          : null,
        sections,
        materials: materialsByArrangement.get(row.id) ?? [],
        totalDurationSec: sections.reduce((sum, section) => sum + (section.durationSec ?? 0), 0),
      }
    })
    .sort((a, b) => compareLevels(a.level, b.level))
}

async function findTags(songId: string) {
  return db
    .select({ id: tags.id, slug: tags.slug, name: tags.name, kind: tags.kind })
    .from(taggables)
    .innerJoin(tags, eq(tags.id, taggables.tagId))
    .where(and(eq(taggables.entityType, 'song'), eq(taggables.entityId, songId)))
    .orderBy(asc(tags.kind), asc(tags.orderIndex))
}

/** Материалы, сгруппированные по объекту, к которому привязаны */
async function findMaterials(
  entityType: 'song' | 'arrangement',
  entityIds: string[],
): Promise<Map<string, MaterialView[]>> {
  const result = new Map<string, MaterialView[]>()
  if (entityIds.length === 0) return result

  const rows = await db
    .select({
      id: attachments.id,
      entityId: attachments.entityId,
      title: attachments.title,
      orderIndex: attachments.orderIndex,
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
    .where(and(eq(attachments.entityType, entityType), inArray(attachments.entityId, entityIds)))
    .orderBy(asc(attachments.orderIndex))

  for (const row of rows) {
    const list = result.get(row.entityId) ?? []

    list.push({
      id: row.id,
      // Подпись куратора важнее названия файла, название файла — важнее
      // общего слова «Материал»: три «Материала» подряд неразличимы
      title: materialTitle(row.title ?? row.assetTitle, row.kind),
      kind: row.kind,
      mediaAssetId: row.mediaAssetId,
      isDownloadable: canDownload(row),
      sizeLabel: formatFileSize(row.sizeBytes),
      isReady: isReady(row.processingStatus),
      // Ключ хранилища наружу не уходит: у интерактивных табов внешний
      // адрес открытый, у файлов ссылка выдаётся отдельно и ненадолго
      externalUrl: isExternalKind(row.kind) ? row.url : null,
    })

    result.set(row.entityId, list)
  }

  return result
}

/**
 * Похожие разборы.
 *
 * Похожесть считается по общим меткам: жанр и техника — это ровно то,
 * по чему человек выбирает следующую песню. Уровень намеренно не учтён:
 * подборка стоит на странице песни, у которой уровней обычно несколько,
 * и привязка к одному из них сузила бы выдачу без пользы.
 *
 * Это работает на принцип «всегда есть что открыть» (PRD v0.1 §1.3):
 * дочитав страницу до конца, человек не упирается в пустоту.
 *
 * Запрос один, с подсчётом совпавших меток. При двухстах разборах это
 * доли миллисекунды; настоящие рекомендации по поведению — Этап 10,
 * и они заменят эту функцию, не задевая страницу.
 */
export async function findSimilarSongs(
  songId: string,
  includeDrafts: boolean,
  limit: number,
): Promise<SongCard[]> {
  const now = new Date()

  const rows = await db
    .select({
      id: songs.id,
      slug: songs.slug,
      title: songs.title,
      artist: songs.artist,
      year: songs.year,
      tuning: songs.tuning,
      status: songs.status,
      publishedAt: songs.publishedAt,
      coverUrl: mediaAssets.url,
      shared: count(taggables.tagId),
    })
    .from(songs)
    .innerJoin(taggables, and(eq(taggables.entityType, 'song'), eq(taggables.entityId, songs.id)))
    .leftJoin(mediaAssets, eq(mediaAssets.id, songs.coverAssetId))
    .where(
      and(
        ne(songs.id, songId),
        visibilityCondition(includeDrafts),
        sql`${taggables.tagId} in (
          select ${taggables.tagId} from ${taggables}
          where ${taggables.entityType} = 'song' and ${taggables.entityId} = ${songId}
        )`,
      ),
    )
    .groupBy(
      songs.id,
      songs.slug,
      songs.title,
      songs.artist,
      songs.year,
      songs.tuning,
      songs.status,
      songs.publishedAt,
      mediaAssets.url,
    )
    .orderBy(desc(count(taggables.tagId)), desc(songs.publishedAt))
    .limit(limit)

  const levelsBySong = await findLevelsForSongs(rows.map((row) => row.id))

  return rows.map((row) => {
    const levels = levelsBySong.get(row.id) ?? []

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      artist: row.artist,
      year: row.year,
      coverUrl: row.coverUrl,
      tuning: row.tuning,
      tuningLabel: tuningLabel(row.tuning),
      levels,
      arrangementCount: levels.length,
      status: row.status,
      publishedAt: row.publishedAt,
      isPublic: isPublicRow(row.status, row.publishedAt, now),
    }
  })
}

/** Все адреса разборов — нужно, чтобы новый адрес не повторил существующий */
export async function findTakenSlugs(prefix: string): Promise<string[]> {
  const rows = await db
    .select({ slug: songs.slug })
    .from(songs)
    .where(ilike(songs.slug, `${prefix}%`))

  return rows.map((row) => row.slug)
}

/**
 * Что показать в фильтрах.
 *
 * Только те метки и кураторы, которые действительно встречаются
 * в разборах. Иначе фильтр из двадцати восьми жанров, двадцать из которых
 * ничего не находят, — человек трижды выбирает пустоту и перестаёт
 * пользоваться фильтрами вообще.
 */
export type CatalogFacets = {
  genres: { slug: string; name: string; count: number }[]
  techniques: { slug: string; name: string; count: number }[]
  curators: { id: string; displayName: string; count: number }[]
}

export async function findCatalogFacets(includeDrafts: boolean): Promise<CatalogFacets> {
  const visible = visibilityCondition(includeDrafts)

  const tagRows = await db
    .select({
      slug: tags.slug,
      name: tags.name,
      kind: tags.kind,
      count: count(taggables.entityId),
    })
    .from(taggables)
    .innerJoin(tags, eq(tags.id, taggables.tagId))
    .innerJoin(songs, eq(songs.id, taggables.entityId))
    .where(and(eq(taggables.entityType, 'song'), visible))
    .groupBy(tags.slug, tags.name, tags.kind, tags.orderIndex)
    .orderBy(asc(tags.orderIndex))

  const curatorRows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      count: count(arrangements.id),
    })
    .from(arrangements)
    .innerJoin(users, eq(users.id, arrangements.curatorId))
    .innerJoin(songs, eq(songs.id, arrangements.songId))
    .where(visible)
    .groupBy(users.id, users.displayName)
    .orderBy(asc(users.displayName))

  return {
    genres: tagRows.filter((row) => row.kind === 'genre'),
    techniques: tagRows.filter((row) => row.kind === 'technique'),
    curators: curatorRows,
  }
}

/**
 * «Возможно, вы имели в виду».
 *
 * Выполняется только когда обычный поиск не нашёл ничего: лишний запрос
 * на каждый удачный поиск не нужен, а на неудачном человеку всё равно
 * нечего делать.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ `word_similarity`, А НЕ `similarity`
 *
 * Обычная похожесть считает две строки целиком и наказывает за разницу
 * в длине. Проверено на живой базе: «metallika» против «Metallica
 * Nothing Else Matters» даёт 0,21 — ниже любого разумного порога.
 * `word_similarity` ищет наиболее похожий кусок внутри строки и даёт
 * для той же пары 0,70.
 *
 * Порог 0,35 подобран там же: настоящие опечатки дают 0,7–0,9,
 * случайные совпадения — меньше 0,2.
 * ─────────────────────────────────────────────────────────────────
 */
export async function findSearchSuggestions(
  rawQuery: string,
  includeDrafts: boolean,
  limit = 3,
): Promise<SongSuggestion[]> {
  const search = parseSearchQuery(rawQuery)
  const inputs = similarityInputs(search)

  if (inputs.length === 0) return []

  // Похожесть считается для каждого варианта запроса, берётся лучшая:
  // триграммы не умеют переходить между алфавитами, и русский запрос
  // без латинского варианта не нашёл бы зарубежную группу
  const target = sql`(${songs.artist} || ' ' || ${songs.title})`
  const score = sql<number>`greatest(${sql.join(
    inputs.map((input) => sql`word_similarity(${input}, ${target})`),
    sql`, `,
  )})`

  const rows = await db
    .select({ slug: songs.slug, title: songs.title, artist: songs.artist, score })
    .from(songs)
    .where(and(visibilityCondition(includeDrafts), sql`${score} > ${SUGGESTION_THRESHOLD}`))
    .orderBy(desc(score))
    .limit(limit)

  return rows.map((row) => ({ slug: row.slug, title: row.title, artist: row.artist }))
}

const SUGGESTION_THRESHOLD = 0.35

/**
 * Разборы по списку идентификаторов.
 *
 * Нужны там, где на разбор ссылается чужое содержимое: блок «связанный
 * разбор» в уроке курса. Порядок ответа не гарантируется — вызывающий
 * раскладывает результат сам, потому что порядок задаёт он.
 */
export async function findSongsByIds(
  ids: string[],
  includeDrafts: boolean,
): Promise<{ id: string; slug: string; title: string; artist: string }[]> {
  if (ids.length === 0) return []

  return db
    .select({
      id: songs.id,
      slug: songs.slug,
      title: songs.title,
      artist: songs.artist,
    })
    .from(songs)
    .where(and(inArray(songs.id, ids), visibilityCondition(includeDrafts)))
}

export type ArrangementRefRow = {
  id: string
  level: string
  songSlug: string
  songTitle: string
  artist: string
}

/**
 * Варианты разбора по списку идентификаторов.
 *
 * Нужны для кнопки «Продолжить»: прогресс хранит только идентификатор,
 * а показать надо песню, исполнителя и уровень. Разборы, снятые
 * с публикации, в ответ не попадают.
 */
export async function findArrangementsByIds(
  ids: string[],
  includeDrafts: boolean,
): Promise<ArrangementRefRow[]> {
  if (ids.length === 0) return []

  return db
    .select({
      id: arrangements.id,
      level: arrangements.level,
      songSlug: songs.slug,
      songTitle: songs.title,
      artist: songs.artist,
    })
    .from(arrangements)
    .innerJoin(songs, eq(songs.id, arrangements.songId))
    .where(
      and(
        inArray(arrangements.id, ids),
        visibilityCondition(includeDrafts),
        includeDrafts ? undefined : eq(arrangements.status, 'published'),
      ),
    )
}

/**
 * Подбор первого разбора для нового участника.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗАЧЕМ ЭТО НУЖНО И ПОЧЕМУ ЗАПРОС ПРОСТОЙ
 *
 * Последний экран знакомства показывает одну кнопку с одной песней.
 * Одна — потому что выбор из двухсот позиций для человека, впервые
 * открывшего платформу, равносилен отсутствию выбора: он закроет вкладку
 * и вернётся «когда будет время» (PRD v0.1 §4.1).
 *
 * Подбор идёт по двум сведениям из знакомства: уровень и жанры. Никакой
 * статистики поведения ещё нет и на новом участнике быть не может, поэтому
 * умнее сделать нельзя — а на двухстах разборах и не нужно.
 *
 * Порядок выдачи: сначала совпадение по числу общих жанров, потом новизна.
 * При равенстве жанров свежий разбор лучше старого: он с большей
 * вероятностью снят в нынешнем качестве.
 * ─────────────────────────────────────────────────────────────────
 *
 * Функция возвращает список, а не одну песню, чтобы сервис мог отбросить
 * то, что человек уже открывал, не делая второго запроса.
 */
export async function findStarterSongs(
  criteria: { level: Level | null; genres: string[] },
  limit: number,
): Promise<SongCard[]> {
  const now = new Date()

  const conditions = [visibilityCondition(false)]

  // Уровень проверяется наличием варианта разбора этого уровня, а не полем
  // песни: уровень живёт в вариантах, и у песни их обычно несколько
  if (criteria.level) {
    conditions.push(
      sql`exists (
        select 1 from ${arrangements}
        where ${arrangements.songId} = ${songs.id}
          and ${arrangements.level} = ${criteria.level}
          and ${arrangements.status} = 'published'
      )`,
    )
  }

  const genreMatch =
    criteria.genres.length > 0
      ? sql<number>`(
          select count(*) from ${taggables}
          join ${tags} on ${tags.id} = ${taggables.tagId}
          where ${taggables.entityType} = 'song'
            and ${taggables.entityId} = ${songs.id}
            and ${tags.kind} = 'genre'
            and ${tags.name} in ${criteria.genres}
        )`
      : sql<number>`0`

  const rows = await db
    .select({
      id: songs.id,
      slug: songs.slug,
      title: songs.title,
      artist: songs.artist,
      year: songs.year,
      tuning: songs.tuning,
      status: songs.status,
      publishedAt: songs.publishedAt,
      coverUrl: mediaAssets.url,
      genreMatch,
    })
    .from(songs)
    .leftJoin(mediaAssets, eq(mediaAssets.id, songs.coverAssetId))
    .where(and(...conditions.filter((condition) => condition !== undefined)))
    .orderBy(desc(genreMatch), desc(songs.publishedAt))
    .limit(limit)

  const levelsBySong = await findLevelsForSongs(rows.map((row) => row.id))

  return rows.map((row) => {
    const levels = levelsBySong.get(row.id) ?? []

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      artist: row.artist,
      year: row.year,
      coverUrl: row.coverUrl,
      tuning: row.tuning,
      tuningLabel: tuningLabel(row.tuning),
      levels,
      arrangementCount: levels.length,
      status: row.status,
      publishedAt: row.publishedAt,
      isPublic: isPublicRow(row.status, row.publishedAt, now),
    }
  })
}
