import 'server-only'

import { and, asc, count, eq, inArray, lt, sql } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'

import { db } from '@/shared/db'
import type { ContentEntity } from '@/shared/db/enums'

import { attachments, mediaAssets } from './schema'

import type { MediaKind } from './domain'

/**
 * Запросы к реестру файлов.
 *
 * Единственное место модуля, где есть SQL. Наружу отдаётся строка
 * как есть, без превращения в вид для интерфейса: этим занимается
 * сервис, потому что решение «показывать ли ключ хранилища» — вопрос
 * доступа, а не хранения.
 */

/** Файл со всем, что нужно, чтобы решить, отдавать его или нет */
export type StoredAssetRow = {
  id: string
  kind: MediaKind
  provider: 'bunny' | 'kinescope' | 's3' | 'soundslice' | 'external'
  /** Для файлов в своём хранилище здесь лежит ключ объекта */
  externalId: string | null
  url: string | null
  title: string | null
  sizeBytes: number | null
  processingStatus: string
  isDownloadable: boolean
}

export async function findAssetById(assetId: string): Promise<StoredAssetRow | null> {
  const [row] = await db
    .select({
      id: mediaAssets.id,
      kind: mediaAssets.kind,
      provider: mediaAssets.provider,
      externalId: mediaAssets.externalId,
      url: mediaAssets.url,
      title: mediaAssets.title,
      sizeBytes: mediaAssets.sizeBytes,
      processingStatus: mediaAssets.processingStatus,
      isDownloadable: mediaAssets.isDownloadable,
    })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, assetId))
    .limit(1)

  return row ?? null
}

/** Ролик уже заведён? Один и тот же файл не должен размножаться записями */
export async function findVideoAssetByExternalId(externalId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: mediaAssets.id })
    .from(mediaAssets)
    .where(and(eq(mediaAssets.kind, 'video'), eq(mediaAssets.externalId, externalId)))
    .limit(1)

  return row?.id ?? null
}

export async function insertVideoAsset(input: {
  externalId: string
  provider: 'kinescope' | 'external'
  title: string | null
  uploadedBy: string
}): Promise<string> {
  const id = uuidv7()

  await db.insert(mediaAssets).values({
    id,
    kind: 'video',
    provider: input.provider,
    externalId: input.externalId,
    title: input.title,
    // Ролик уже обработан хостингом: мы его не загружали, а только записали
    processingStatus: 'ready',
    // Видео не скачивается никогда — ради этого и выбирается видеохостинг
    isDownloadable: false,
    uploadedBy: input.uploadedBy,
  })

  return id
}

// ─────────────────────────────────────────────────────────────────
// ЗАГРУЖЕННЫЕ ФАЙЛЫ И ИХ ПРИВЯЗКИ
//
// Порядок записи при загрузке: сначала строка о файле в состоянии
// «загружается», потом байты в хранилище, потом отметка о готовности
// и привязка. Так ключ хранилища известен базе ДО того, как файл
// появится, и оборванная на середине загрузка оставляет след, по
// которому её найдёт ночная уборка. Обратный порядок оставлял бы
// в хранилище файлы, о которых никто не помнит, — а перечислять
// содержимое хранилища мы не умеем и уметь не хотим.
// ─────────────────────────────────────────────────────────────────

/** Заводит запись о файле до записи байтов. Возвращает идентификатор */
export async function insertPendingFileAsset(input: {
  /** Задаётся снаружи: тот же идентификатор входит в имя файла в хранилище */
  id: string
  kind: MediaKind
  /** Ключ объекта в хранилище: для своего хранилища это и есть «идентификатор» */
  key: string
  title: string | null
  isDownloadable: boolean
  uploadedBy: string
}): Promise<string> {
  const id = input.id

  await db.insert(mediaAssets).values({
    id,
    kind: input.kind,
    provider: 's3',
    externalId: input.key,
    title: input.title,
    processingStatus: 'uploading',
    isDownloadable: input.isDownloadable,
    uploadedBy: input.uploadedBy,
  })

  return id
}

/** Файл записан в хранилище и готов к выдаче */
export async function markAssetReady(assetId: string, sizeBytes: number): Promise<void> {
  await db
    .update(mediaAssets)
    .set({ processingStatus: 'ready', sizeBytes, updatedAt: new Date() })
    .where(eq(mediaAssets.id, assetId))
}

/** Материал, живущий по чужому адресу: интерактивные табы */
export async function insertExternalAsset(input: {
  kind: MediaKind
  provider: 'soundslice' | 'external'
  url: string
  title: string | null
  uploadedBy: string
}): Promise<string> {
  const id = uuidv7()

  await db.insert(mediaAssets).values({
    id,
    kind: input.kind,
    provider: input.provider,
    url: input.url,
    title: input.title,
    // Обрабатывать нечего: страница уже существует у поставщика
    processingStatus: 'ready',
    // Скачивать нечего: это адрес, а не файл
    isDownloadable: false,
    uploadedBy: input.uploadedBy,
  })

  return id
}

export async function updateAssetDownloadable(
  assetId: string,
  isDownloadable: boolean,
): Promise<void> {
  await db
    .update(mediaAssets)
    .set({ isDownloadable, updatedAt: new Date() })
    .where(eq(mediaAssets.id, assetId))
}

export async function deleteAssetRow(assetId: string): Promise<void> {
  await db.delete(mediaAssets).where(eq(mediaAssets.id, assetId))
}

/** Привязка файла к песне, варианту разбора, уроку или эфиру */
export async function insertAttachment(input: {
  entityType: ContentEntity
  entityId: string
  mediaAssetId: string
  title: string | null
  orderIndex: number
}): Promise<string> {
  const id = uuidv7()

  await db.insert(attachments).values({ id, ...input })

  return id
}

export type AttachmentRow = {
  id: string
  entityType: ContentEntity
  entityId: string
  mediaAssetId: string
  title: string | null
  orderIndex: number
}

/**
 * Привязка со всем, что нужно для проверки прав.
 *
 * Возвращает объект, к которому файл привязан: право трогать материал
 * равно праву править этот объект, и решает это не модуль медиа.
 */
export async function findAttachmentById(attachmentId: string): Promise<AttachmentRow | null> {
  const [row] = await db
    .select({
      id: attachments.id,
      entityType: attachments.entityType,
      entityId: attachments.entityId,
      mediaAssetId: attachments.mediaAssetId,
      title: attachments.title,
      orderIndex: attachments.orderIndex,
    })
    .from(attachments)
    .where(eq(attachments.id, attachmentId))
    .limit(1)

  return row ?? null
}

export async function updateAttachmentTitle(
  attachmentId: string,
  title: string | null,
): Promise<void> {
  await db.update(attachments).set({ title }).where(eq(attachments.id, attachmentId))
}

export async function updateAttachmentOrder(
  attachmentId: string,
  orderIndex: number,
): Promise<void> {
  await db.update(attachments).set({ orderIndex }).where(eq(attachments.id, attachmentId))
}

export async function deleteAttachmentRow(attachmentId: string): Promise<void> {
  await db.delete(attachments).where(eq(attachments.id, attachmentId))
}

/**
 * Сколько ещё мест ссылается на этот файл.
 *
 * Один файл может быть привязан к нескольким объектам: минусовка нужна
 * и на странице песни, и в уроке, который её разбирает. Поэтому удаление
 * материала снимает привязку, а сам файл убирается только когда исчезла
 * последняя.
 */
export async function countAttachmentsForAsset(assetId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(attachments)
    .where(eq(attachments.mediaAssetId, assetId))

  return row?.value ?? 0
}

/** Следующий порядковый номер в списке материалов объекта */
export async function nextAttachmentOrder(
  entityType: ContentEntity,
  entityId: string,
): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`coalesce(max(${attachments.orderIndex}), -1) + 1` })
    .from(attachments)
    .where(and(eq(attachments.entityType, entityType), eq(attachments.entityId, entityId)))

  return row?.value ?? 0
}

export type MaterialEditorRow = {
  id: string
  entityId: string
  assetId: string
  kind: MediaKind
  /** Подпись, заданная куратором. Пустая — значит показывается вид файла */
  title: string | null
  orderIndex: number
  sizeBytes: number | null
  processingStatus: string
  isDownloadable: boolean
  url: string | null
}

/** Материалы нескольких объектов сразу: у разбора это песня и все варианты */
export async function findMaterialsForEditor(
  entityType: ContentEntity,
  entityIds: string[],
): Promise<MaterialEditorRow[]> {
  if (entityIds.length === 0) return []

  return db
    .select({
      id: attachments.id,
      entityId: attachments.entityId,
      assetId: mediaAssets.id,
      kind: mediaAssets.kind,
      title: attachments.title,
      orderIndex: attachments.orderIndex,
      sizeBytes: mediaAssets.sizeBytes,
      processingStatus: mediaAssets.processingStatus,
      isDownloadable: mediaAssets.isDownloadable,
      url: mediaAssets.url,
    })
    .from(attachments)
    .innerJoin(mediaAssets, eq(mediaAssets.id, attachments.mediaAssetId))
    .where(and(eq(attachments.entityType, entityType), inArray(attachments.entityId, entityIds)))
    .orderBy(asc(attachments.orderIndex))
}

/** Привязки одного объекта по порядку — нужно при перестановке */
export async function findAttachmentIdsInOrder(
  entityType: ContentEntity,
  entityId: string,
): Promise<string[]> {
  const rows = await db
    .select({ id: attachments.id })
    .from(attachments)
    .where(and(eq(attachments.entityType, entityType), eq(attachments.entityId, entityId)))
    .orderBy(asc(attachments.orderIndex))

  return rows.map((row) => row.id)
}

/**
 * Файлы, застрявшие в состоянии «загружается».
 *
 * Такая строка означает оборванную загрузку: браузер закрыли на середине,
 * связь пропала, процесс перезапустился. Через сутки надежды нет —
 * ни один файл не загружается сутки.
 */
export async function findStalledUploads(
  before: Date,
): Promise<{ id: string; key: string | null }[]> {
  return db
    .select({ id: mediaAssets.id, key: mediaAssets.externalId })
    .from(mediaAssets)
    .where(and(eq(mediaAssets.processingStatus, 'uploading'), lt(mediaAssets.createdAt, before)))
    .limit(200)
}

/**
 * Сколько файлов и роликов не доехали (шаг 9.7).
 *
 * Сбой обработки не виден нигде, кроме страницы, где файл ждали:
 * куратор прикрепил таб, ушёл, а файл не залился. Число на обзоре —
 * единственное место, где это всплывает само.
 */
export async function countFailedAssets(): Promise<number> {
  const [row] = await db
    .select({ total: count(mediaAssets.id) })
    .from(mediaAssets)
    .where(eq(mediaAssets.processingStatus, 'failed'))

  return row?.total ?? 0
}
