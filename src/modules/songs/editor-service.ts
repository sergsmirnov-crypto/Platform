import 'server-only'

import { requirePermission } from '@/modules/access'
import { AUDIT_ACTIONS, recordAudit } from '@/modules/audit'
import { errors } from '@/shared/errors'
import { slugify } from '@/shared/utils/slug'

import { sectionsFromTemplate } from './domain'
import {
  countArrangements,
  findSongsOverview,
  deleteArrangement,
  deleteSection,
  findArrangementOwner,
  findArrangementsForPublication,
  findFreeSlug,
  findSongForEditing,
  insertArrangement,
  insertSections,
  insertSong,
  replaceSongTags,
  reorderSections,
  updateArrangement,
  updateArrangementStatus,
  updateArrangementVideo,
  updateSong,
  updateSongStatus,
  upsertSection,
} from './editor-repository'
import { findPublicationBlockers } from './publication'

import type { ArrangementInput, SectionInput, SongInput } from './editor-schema'

/**
 * Редактирование разборов.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЕДИНСТВЕННОЕ МЕСТО, ГДЕ ПРОВЕРЯЮТСЯ ПРАВА НА ИЗМЕНЕНИЕ
 *
 * Каждая функция начинается с `requirePermission`. Это не перестраховка:
 * скрытая в интерфейсе кнопка — удобство, а не защита, и обратиться
 * к серверу можно минуя интерфейс (ARCHITECTURE §6).
 *
 * Отдельно про область прав. У базового куратора она равна `own`:
 * он правит только те разборы, где указан куратором. Поэтому проверка
 * получает третьим аргументом владельца объекта — и для этого объект
 * приходится сначала загрузить. Отсюда порядок «найти → проверить →
 * изменить», а не «проверить → найти».
 * ─────────────────────────────────────────────────────────────────
 */

/** Создание песни. Всегда черновиком: ничего не публикуется случайно */
export async function createSong(actorId: string, input: SongInput): Promise<string> {
  await requirePermission(actorId, 'songs.create')

  const slug = await findFreeSlug(slugify(`${input.artist} ${input.title}`))
  const songId = await insertSong(input, slug, actorId)

  await replaceSongTags(songId, input.tagIds)
  await recordAudit({
    actorId,
    action: AUDIT_ACTIONS.songCreate,
    entityType: 'song',
    entityId: songId,
    entityTitle: songLabel(input),
  })

  return songId
}

export async function editSong(actorId: string, songId: string, input: SongInput): Promise<void> {
  const song = await requireSong(songId)
  await requirePermission(actorId, 'songs.edit', song.createdBy)

  // Адрес пересчитывается при смене названия или исполнителя: ссылка
  // должна оставаться читаемой. Прежний адрес при этом перестаёт
  // работать — осознанный размен, разборов с внешними ссылками у нас нет
  const slug = await findFreeSlug(slugify(`${input.artist} ${input.title}`), songId)

  await updateSong(songId, input, slug)
  await replaceSongTags(songId, input.tagIds)

  await recordAudit({
    actorId,
    action: AUDIT_ACTIONS.songEdit,
    entityType: 'song',
    entityId: songId,
    entityTitle: songLabel(input),
  })
}

/**
 * Публикация.
 *
 * Проверка готовности живёт здесь, а не в форме: форма подсказывает,
 * сервер решает. Иначе достаточно обратиться к серверу минуя интерфейс,
 * чтобы опубликовать пустой разбор.
 */
export async function publishSong(actorId: string, songId: string): Promise<void> {
  const song = await requireSong(songId)
  await requirePermission(actorId, 'songs.publish', song.createdBy)

  const arrangementStates = await findArrangementsForPublication(songId)
  const blockers = findPublicationBlockers({
    title: song.title,
    artist: song.artist,
    arrangements: arrangementStates,
  })

  if (blockers.length > 0) {
    // Ошибка по полям: форма подсветит именно то, чего не хватает,
    // а не покажет окно «нельзя опубликовать» без объяснения
    throw errors.validation(
      Object.fromEntries(blockers.map((blocker) => [blocker.field, blocker.message])),
    )
  }

  await updateSongStatus(songId, 'published', new Date())
  await recordAudit({
    actorId,
    action: AUDIT_ACTIONS.songPublish,
    entityType: 'song',
    entityId: songId,
    entityTitle: songLabel(song),
  })
}

/** Снятие с публикации возвращает в черновик, а не в архив */
export async function unpublishSong(actorId: string, songId: string): Promise<void> {
  const song = await requireSong(songId)
  await requirePermission(actorId, 'songs.publish', song.createdBy)

  await updateSongStatus(songId, 'draft', null)
  await recordAudit({
    actorId,
    action: AUDIT_ACTIONS.songUnpublish,
    entityType: 'song',
    entityId: songId,
    entityTitle: songLabel(song),
  })
}

/**
 * Удаление — в архив, а не из базы.
 *
 * У разбора есть прогресс участников, заметки и избранное. Физическое
 * удаление обрушило бы их вместе с разбором, а «куда делся разбор
 * Nothing Else Matters» — самый частый вопрос в таких системах
 * (PRD v0.3 §6).
 */
export async function archiveSong(actorId: string, songId: string): Promise<void> {
  const song = await requireSong(songId)
  await requirePermission(actorId, 'songs.delete', song.createdBy)

  await updateSongStatus(songId, 'archived', null)
  await recordAudit({
    actorId,
    action: AUDIT_ACTIONS.songArchive,
    entityType: 'song',
    entityId: songId,
    entityTitle: songLabel(song),
  })
}

/**
 * Создание варианта разбора.
 *
 * Куратором становится тот, кто создал: это и авторство на странице
 * песни, и область прав «только свой контент». Переназначение — отдельное
 * действие для старшего куратора.
 *
 * Шаблон структуры создаёт части сразу. Ручное создание шести частей —
 * это две минуты, помноженные на двести разборов при переносе архива.
 */
export async function createArrangement(
  actorId: string,
  songId: string,
  input: ArrangementInput,
  templateCode: string,
): Promise<string> {
  const song = await requireSong(songId)
  await requirePermission(actorId, 'songs.edit', song.createdBy)

  const orderIndex = await countArrangements(songId)
  const arrangementId = await insertArrangement(songId, input, actorId, orderIndex)

  await insertSections(arrangementId, sectionsFromTemplate(templateCode), 0)
  await recordAudit({
    actorId,
    action: AUDIT_ACTIONS.arrangementCreate,
    entityType: 'arrangement',
    entityId: arrangementId,
    entityTitle: songLabel(song),
    diff: { songId, level: input.level, template: templateCode },
  })

  return arrangementId
}

export async function editArrangement(
  actorId: string,
  arrangementId: string,
  input: ArrangementInput,
): Promise<void> {
  const owner = await requireArrangement(arrangementId)
  await requirePermission(actorId, 'songs.edit', owner.curatorId)

  await updateArrangement(arrangementId, input)
}

export async function setArrangementPublished(
  actorId: string,
  arrangementId: string,
  published: boolean,
): Promise<void> {
  const owner = await requireArrangement(arrangementId)
  await requirePermission(actorId, 'songs.publish', owner.curatorId)

  await updateArrangementStatus(arrangementId, published ? 'published' : 'draft')
}

export async function removeArrangement(actorId: string, arrangementId: string): Promise<void> {
  const owner = await requireArrangement(arrangementId)
  await requirePermission(actorId, 'songs.delete', owner.curatorId)

  await deleteArrangement(arrangementId)
  await recordAudit({
    actorId,
    action: AUDIT_ACTIONS.arrangementDelete,
    entityType: 'arrangement',
    entityId: arrangementId,
    entityTitle: owner.songLabel,
    diff: { level: owner.level },
  })
}

export async function saveSection(
  actorId: string,
  arrangementId: string,
  input: SectionInput,
  orderIndex: number,
): Promise<string> {
  const owner = await requireArrangement(arrangementId)
  await requirePermission(actorId, 'songs.edit', owner.curatorId)

  return upsertSection(arrangementId, input, orderIndex)
}

export async function removeSection(
  actorId: string,
  arrangementId: string,
  sectionId: string,
): Promise<void> {
  const owner = await requireArrangement(arrangementId)
  await requirePermission(actorId, 'songs.edit', owner.curatorId)

  await deleteSection(sectionId)
}

export async function reorder(
  actorId: string,
  arrangementId: string,
  sectionIds: string[],
): Promise<void> {
  const owner = await requireArrangement(arrangementId)
  await requirePermission(actorId, 'songs.edit', owner.curatorId)

  await reorderSections(arrangementId, sectionIds)
}

async function requireSong(songId: string) {
  const song = await findSongForEditing(songId)
  if (!song) throw errors.notFound('Разбор не найден')

  return song
}

async function requireArrangement(arrangementId: string) {
  const owner = await findArrangementOwner(arrangementId)
  if (!owner) throw errors.notFound('Вариант разбора не найден')

  return owner
}

/**
 * Право трогать эту песню.
 *
 * Нужно там, где действие выполняет соседний модуль: загрузка материала
 * к песне сначала спрашивает разрешение здесь и только потом обращается
 * к модулю медиа. Собрать оба шага в одном месте нельзя — разборы
 * не должны знать внутренности медиа, а медиа не знает правил разборов.
 */
export async function assertCanEditSong(actorId: string, songId: string): Promise<void> {
  const song = await requireSong(songId)
  await requirePermission(actorId, 'songs.edit', song.createdBy)
}

/**
 * Право трогать этот вариант разбора.
 *
 * Отдельная проверка, потому что привязка ролика делается в два приёма:
 * сначала модуль медиа заводит запись о ролике, потом мы её привязываем.
 * Без этой проверки первым шагом можно было бы наплодить записей о роликах,
 * не имея права трогать сам разбор.
 *
 * Собирать оба шага внутри модуля нельзя: разборы не должны знать
 * внутренности медиа, а публичный вход медиа намеренно не тянет серверный
 * код — его импортируют браузерные компоненты.
 */
export async function assertCanEditArrangement(
  actorId: string,
  arrangementId: string,
): Promise<void> {
  const owner = await requireArrangement(arrangementId)
  await requirePermission(actorId, 'songs.edit', owner.curatorId)
}

/** Привязка уже заведённого ролика к варианту разбора */
export async function attachVideo(
  actorId: string,
  arrangementId: string,
  assetId: string | null,
): Promise<void> {
  await assertCanEditArrangement(actorId, arrangementId)
  await updateArrangementVideo(arrangementId, assetId)
}

/**
 * Как разбор называется в журнале действий.
 *
 * Собирается в момент действия и сохраняется в записи: после удаления
 * или архивации взять название будет неоткуда, а «куда делся разбор
 * Nothing Else Matters» — тот самый вопрос, ради которого журнал заведён
 * (PRD v0.3 §6).
 */
function songLabel(song: { title: string; artist: string }): string {
  return `${song.artist} — ${song.title}`
}

/**
 * Сводка по разборам для экрана «Обзор» (шаг 9.7).
 *
 * Право то же, что у списка разборов: если человеку нельзя видеть
 * черновики, ему нечего показывать и в сводке.
 */
export async function getSongsOverview(
  actorId: string,
  input: { publishedSince: Date; staleBefore: Date; limit: number },
) {
  await requirePermission(actorId, 'songs.view_drafts')

  return findSongsOverview(input)
}
