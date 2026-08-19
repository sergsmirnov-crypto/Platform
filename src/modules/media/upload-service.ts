import 'server-only'

import { v7 as uuidv7 } from 'uuid'

import type { ContentEntity } from '@/shared/db/enums'
import { errors } from '@/shared/errors'
import { getLogger } from '@/shared/logger'
import { getStorage } from '@/shared/storage'
import { buildKey, isWithinLimit } from '@/shared/storage/keys'

import {
  deleteAssetRow,
  findStalledUploads,
  insertAttachment,
  insertPendingFileAsset,
  markAssetReady,
  nextAttachmentOrder,
} from './repository'
import { defaultMaterialTitle, describeUpload, uploadErrors } from './upload'

/**
 * Приём загруженного файла.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ БАЙТЫ ИДУТ ЧЕРЕЗ НАШ СЕРВЕР
 *
 * Привычное решение — подписанная ссылка: браузер отправляет файл прямо
 * в хранилище, минуя нас. Оно правильное при больших объёмах и выбрано
 * не было. Три причины (подробно — ADR-0016):
 *
 *   1. Прямая загрузка требует настройки правил CORS на стороне
 *      хранилища. У российских поставщиков это нередко обращение
 *      в поддержку, а не переключатель в панели.
 *   2. Появляется второй путь кода: «запросить ссылку» и «подтвердить
 *      загрузку», плюс файлы, о которых база не знает.
 *   3. Размер и содержимое проверяются ДО записи, а не после.
 *
 * Плата — трафик через наш сервер. При переносе архива это около
 * гигабайта разово, дальше несколько файлов в неделю. Видео этим путём
 * не идёт никогда: ролики живут на видеохостинге.
 *
 * Порог пересмотра зафиксирован в ADR-0016: загрузка видео из браузера
 * или файлы тяжелее ста мегабайт.
 * ─────────────────────────────────────────────────────────────────
 *
 * ⚠️ Прав здесь не проверяем и проверять не можем. Право положить файл
 * к разбору — это право править ЭТОТ разбор, со всей его областью
 * «только свой контент». Знание об этом живёт в модуле разборов,
 * а вызов делает слой приложения: сначала проверка, потом загрузка.
 */

/** Виды, которые участник может скачать. Внешние ссылки сюда не входят */
const DOWNLOADABLE_KINDS = new Set(['pdf', 'guitar_pro', 'audio', 'image'])

export type StoreMaterialInput = {
  entityType: ContentEntity
  entityId: string
  /** Имя файла, как его прислал браузер. Источник вида файла и подписи */
  fileName: string
  bytes: Buffer
  uploadedBy: string
}

export type StoredMaterial = { attachmentId: string; assetId: string }

export async function storeMaterial(input: StoreMaterialInput): Promise<StoredMaterial> {
  const descriptor = describeUpload(input.fileName)

  if (!descriptor) {
    throw errors.validation({ file: uploadErrors.unsupported })
  }

  if (input.bytes.byteLength === 0) {
    throw errors.validation({ file: uploadErrors.empty })
  }

  if (!isWithinLimit(input.bytes.byteLength, descriptor.limitBytes)) {
    throw errors.validation({ file: uploadErrors.tooLarge(descriptor.limitBytes) })
  }

  const assetId = uuidv7()

  // Идентификатор записи входит в имя файла: увидев ключ в хранилище,
  // всегда можно найти строку в базе, и наоборот. При разборе жалобы
  // «таб не скачивается» это экономит полчаса
  const key = buildKey({
    visibility: 'private',
    folder: 'materials',
    ownerId: input.entityId,
    uniquePart: assetId,
    extension: descriptor.extension,
  })

  await insertPendingFileAsset({
    id: assetId,
    kind: descriptor.kind,
    key,
    title: defaultMaterialTitle(input.fileName),
    isDownloadable: DOWNLOADABLE_KINDS.has(descriptor.kind),
    uploadedBy: input.uploadedBy,
  })

  try {
    await getStorage().put({
      key,
      body: input.bytes,
      // Тип назначаем мы, а не браузер: см. `upload.ts`
      contentType: descriptor.contentType,
      visibility: 'private',
    })
  } catch (error) {
    // Файла нет — значит и строки быть не должно. Если убрать её
    // не удалось, её подберёт ночная уборка: состояние осталось
    // «загружается»
    await deleteAssetRow(assetId).catch(() => undefined)

    throw errors.upstream('storage', error)
  }

  await markAssetReady(assetId, input.bytes.byteLength)

  const orderIndex = await nextAttachmentOrder(input.entityType, input.entityId)

  const attachmentId = await insertAttachment({
    entityType: input.entityType,
    entityId: input.entityId,
    mediaAssetId: assetId,
    // Подпись живёт на привязке, а не на файле: один и тот же файл
    // в разных местах может называться по-разному
    title: defaultMaterialTitle(input.fileName),
    orderIndex,
  })

  getLogger().info(
    {
      assetId,
      attachmentId,
      kind: descriptor.kind,
      bytes: input.bytes.byteLength,
      entityType: input.entityType,
    },
    'загружен материал',
  )

  return { attachmentId, assetId }
}

/**
 * Уборка оборванных загрузок.
 *
 * Строка в состоянии «загружается» старше суток означает, что запись
 * завели, а байты не доехали: закрыли вкладку, пропала связь, упал
 * процесс. Ни один файл не загружается сутки.
 *
 * Без уборки такие строки копятся вечно и однажды всплывают в отчётах
 * как «материалы, которые не скачиваются». Заодно из хранилища убирается
 * то, что успело туда попасть.
 */
export async function cleanupStalledUploads(olderThanHours: number): Promise<number> {
  const before = new Date(Date.now() - olderThanHours * 60 * 60 * 1000)
  const stalled = await findStalledUploads(before)

  for (const asset of stalled) {
    if (asset.key) {
      // Файла почти наверняка нет — это нормально и ошибкой не считается
      await getStorage()
        .delete(asset.key)
        .catch(() => undefined)
    }

    await deleteAssetRow(asset.id)
  }

  return stalled.length
}
