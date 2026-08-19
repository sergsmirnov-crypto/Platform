import 'server-only'

import type { ContentEntity } from '@/shared/db/enums'
import { errors } from '@/shared/errors'
import { getLogger } from '@/shared/logger'
import { getStorage } from '@/shared/storage'

import { canDownload, formatFileSize, isExternalKind, isReady, materialTitle } from './domain'
import {
  countAttachmentsForAsset,
  deleteAssetRow,
  deleteAttachmentRow,
  findAssetById,
  findAttachmentById,
  findAttachmentIdsInOrder,
  findMaterialsForEditor,
  insertAttachment,
  insertExternalAsset,
  nextAttachmentOrder,
  updateAssetDownloadable,
  updateAttachmentOrder,
  updateAttachmentTitle,
} from './repository'
import { externalProvider } from './upload'

import type { AttachmentRow } from './repository'
import type { EditorMaterial } from './types'
import type { ExternalMaterialInput } from './upload'

/**
 * Материалы, привязанные к содержимому.
 *
 * ⚠️ Прав здесь не проверяем — как и в загрузке. Право трогать материал
 * равно праву править объект, к которому он привязан, а знает об этом
 * модуль содержимого. Поэтому наружу отдаётся `findMaterialOwner`:
 * слой приложения сначала спрашивает, к чему привязан материал, потом
 * проверяет право на этот объект и только затем зовёт изменение.
 *
 * Порядок именно такой, а не «изменить и проверить»: иначе тот, у кого
 * прав нет, успел бы переименовать чужой таб до отказа.
 */

/**
 * К чему привязан материал.
 *
 * Единственный способ для слоя приложения узнать, чьё право проверять.
 */
export async function findMaterialOwner(attachmentId: string): Promise<AttachmentRow> {
  const row = await findAttachmentById(attachmentId)
  if (!row) throw errors.notFound('Материал не найден')

  return row
}

/** Материалы нескольких объектов сразу, сгруппированные по объекту */
export async function listMaterials(
  entityType: ContentEntity,
  entityIds: string[],
): Promise<Map<string, EditorMaterial[]>> {
  const rows = await findMaterialsForEditor(entityType, entityIds)
  const grouped = new Map<string, EditorMaterial[]>()

  for (const row of rows) {
    const list = grouped.get(row.entityId) ?? []

    list.push({
      id: row.id,
      assetId: row.assetId,
      kind: row.kind,
      title: row.title,
      displayTitle: materialTitle(row.title, row.kind),
      sizeLabel: formatFileSize(row.sizeBytes),
      isReady: isReady(row.processingStatus),
      isDownloadable: canDownload(row),
      isExternal: isExternalKind(row.kind),
      externalUrl: isExternalKind(row.kind) ? row.url : null,
    })

    grouped.set(row.entityId, list)
  }

  return grouped
}

export async function renameMaterial(attachmentId: string, title: string | null): Promise<void> {
  await updateAttachmentTitle(attachmentId, title)
}

/**
 * Перестановка материала на одну позицию.
 *
 * Кнопками «выше/ниже», а не перетаскиванием: перетаскивание ломается
 * на сенсорном экране внутри прокрутки и недоступно с клавиатуры.
 * Материалов у разбора три-четыре, переставляют их редко — то же
 * решение, что для частей разбора (ADR-0015).
 *
 * Номера переписываются подряд для всего списка. Это дороже точечного
 * обмена двух строк, но избавляет от дыр и повторов в нумерации,
 * которые копятся годами и однажды дают непредсказуемый порядок.
 */
export async function moveMaterial(
  attachment: AttachmentRow,
  direction: 'up' | 'down',
): Promise<void> {
  const ordered = await findAttachmentIdsInOrder(attachment.entityType, attachment.entityId)
  const index = ordered.indexOf(attachment.id)

  if (index === -1) return

  const target = direction === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= ordered.length) return

  const swapped = [...ordered]
  const current = swapped[index] as string
  swapped[index] = swapped[target] as string
  swapped[target] = current

  await Promise.all(swapped.map((id, position) => updateAttachmentOrder(id, position)))
}

/**
 * Разрешение скачивать.
 *
 * Свойство файла, а не привязки: тот же файл, привязанный к уроку
 * и к разбору, не может быть скачиваемым в одном месте и нет в другом —
 * ссылка-то одна. Куратору это видно по формулировке «скачивание
 * файла», а не «скачивание материала».
 */
export async function setMaterialDownloadable(
  attachment: AttachmentRow,
  isDownloadable: boolean,
): Promise<void> {
  const asset = await findAssetById(attachment.mediaAssetId)
  if (!asset) throw errors.notFound('Файл не найден')

  if (isExternalKind(asset.kind)) {
    throw errors.conflict('Внешние табы открываются по ссылке и не скачиваются')
  }

  await updateAssetDownloadable(attachment.mediaAssetId, isDownloadable)
}

/**
 * Снятие материала.
 *
 * Сначала убирается привязка, и только если на файл больше никто
 * не ссылается — сам файл. Один файл может быть привязан к нескольким
 * объектам: минусовка нужна и на странице песни, и в уроке, который
 * её разбирает. Удалять файл вместе с первой же привязкой означало бы
 * ломать второе место без предупреждения.
 */
export async function removeMaterial(attachment: AttachmentRow): Promise<void> {
  await deleteAttachmentRow(attachment.id)

  const remaining = await countAttachmentsForAsset(attachment.mediaAssetId)
  if (remaining > 0) return

  const asset = await findAssetById(attachment.mediaAssetId)

  // У своего хранилища «идентификатор у поставщика» — это ключ объекта.
  // У внешних материалов ключа нет: удалять нечего
  if (asset?.provider === 's3' && asset.externalId) {
    try {
      await getStorage().delete(asset.externalId)
    } catch (error) {
      // Оставшийся файл на сорок килобайт не повод обрывать успешное
      // действие. Остаётся запись в журнале
      getLogger().warn({ err: error, assetId: asset.id }, 'не удалось убрать файл из хранилища')
    }
  }

  await deleteAssetRow(attachment.mediaAssetId)

  getLogger().info({ assetId: attachment.mediaAssetId }, 'материал удалён')
}

/** Интерактивные табы и прочее, что живёт по чужому адресу */
export async function addExternalMaterial(input: {
  entityType: ContentEntity
  entityId: string
  values: ExternalMaterialInput
  uploadedBy: string
}): Promise<string> {
  const assetId = await insertExternalAsset({
    kind: 'interactive_tab',
    provider: externalProvider(input.values.url),
    url: input.values.url,
    title: input.values.title,
    uploadedBy: input.uploadedBy,
  })

  return insertAttachment({
    entityType: input.entityType,
    entityId: input.entityId,
    mediaAssetId: assetId,
    title: input.values.title,
    orderIndex: await nextAttachmentOrder(input.entityType, input.entityId),
  })
}
