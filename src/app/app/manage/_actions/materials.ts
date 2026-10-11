'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { authorizeAttachmentTarget, requireAttachmentTarget } from '@/app/_lib/attachment-access'
import type { AttachmentTarget } from '@/app/_lib/attachment-access'
import { AUDIT_ACTIONS, recordAudit } from '@/modules/audit'
import { getSession } from '@/modules/identity/current-user'
import { externalMaterialSchema, materialTitleSchema } from '@/modules/media'
import {
  addExternalMaterial,
  findMaterialOwner,
  moveMaterial,
  removeMaterial,
  renameMaterial,
  setMaterialDownloadable,
} from '@/modules/media/materials-service'
import { errors } from '@/shared/errors'
import { routes } from '@/shared/routes'
import { defineAction } from '@/shared/server'

/**
 * Управление материалами.
 *
 * Байты сюда не попадают: их принимает обработчик адреса
 * `/api/media/upload`. Здесь всё, что делается с уже загруженным, —
 * подпись, порядок, разрешение скачивать, удаление и добавление ссылки.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОРЯДОК ПРОВЕРОК ОДИНАКОВ ВЕЗДЕ
 *
 *   1. кто это           → сессия
 *   2. к чему привязано  → модуль медиа
 *   3. можно ли ему      → право править ЭТОТ объект
 *   4. изменение
 *
 * Шаг 2 обязателен и не может быть пропущен: идентификатор привязки
 * приходит из браузера, и без него мы бы проверяли право на объект,
 * который прислал сам проверяемый.
 * ─────────────────────────────────────────────────────────────────
 */

async function actor(): Promise<string> {
  const session = await getSession()
  if (!session) throw errors.unauthorized()

  return session.user.id
}

/**
 * Сброс кэша.
 *
 * Материал виден в двух местах: в редакторе и на странице участника.
 * Какая это страница — знает интерфейс, поэтому её адрес приходит
 * параметром: искать его по идентификатору привязки значило бы делать
 * лишний запрос ради того, что вызывающему уже известно.
 *
 * Присланный адрес ничего не открывает и ничего не отдаёт — он только
 * помечает страницу устаревшей. Поэтому проверки здесь достаточно
 * поверхностной: адрес внутри платформы, не чужой сайт.
 */
function revalidateMaterials(entityType: AttachmentTarget, publicPath: string | null): void {
  revalidatePath(entityType === 'stream' ? routes.app.manage.streams() : routes.app.manage.songs())

  if (publicPath?.startsWith('/app/')) revalidatePath(publicPath)
}

/**
 * Общая часть всех действий: найти привязку и проверить право на объект.
 *
 * Вынесено, потому что повторяется пять раз, а пропущенная проверка
 * в одном из пяти мест не видна при чтении кода.
 */
async function requireOwnedMaterial(attachmentId: string) {
  const actorId = await actor()
  const attachment = await findMaterialOwner(attachmentId)
  const entityType = requireAttachmentTarget(attachment.entityType)

  await authorizeAttachmentTarget(actorId, entityType, attachment.entityId)

  return { actorId, attachment }
}

/** Страница участника, которую надо перечитать после правки */
const withPath = { publicPath: z.string().max(200).nullable().default(null) }

export const renameMaterialAction = defineAction({
  name: 'media.material.rename',
  input: z.object({
    attachmentId: z.uuid(),
    title: materialTitleSchema,
    ...withPath,
  }),
  handler: async ({ attachmentId, title, publicPath }) => {
    const { attachment } = await requireOwnedMaterial(attachmentId)
    await renameMaterial(attachmentId, title)
    revalidateMaterials(attachment.entityType as AttachmentTarget, publicPath)

    return { title }
  },
})

export const moveMaterialAction = defineAction({
  name: 'media.material.move',
  input: z.object({
    attachmentId: z.uuid(),
    direction: z.enum(['up', 'down']),
    ...withPath,
  }),
  handler: async ({ attachmentId, direction, publicPath }) => {
    const { attachment } = await requireOwnedMaterial(attachmentId)
    await moveMaterial(attachment, direction)
    revalidateMaterials(attachment.entityType as AttachmentTarget, publicPath)

    return { moved: true }
  },
})

export const setMaterialDownloadableAction = defineAction({
  name: 'media.material.downloadable',
  input: z.object({
    attachmentId: z.uuid(),
    isDownloadable: z.boolean(),
    ...withPath,
  }),
  handler: async ({ attachmentId, isDownloadable, publicPath }) => {
    const { attachment } = await requireOwnedMaterial(attachmentId)
    await setMaterialDownloadable(attachment, isDownloadable)
    revalidateMaterials(attachment.entityType as AttachmentTarget, publicPath)

    return { isDownloadable }
  },
})

export const deleteMaterialAction = defineAction({
  name: 'media.material.delete',
  input: z.object({ attachmentId: z.uuid(), ...withPath }),
  handler: async ({ attachmentId, publicPath }) => {
    const { actorId, attachment } = await requireOwnedMaterial(attachmentId)

    await removeMaterial(attachment)
    await recordAudit({
      actorId,
      action: AUDIT_ACTIONS.materialDelete,
      entityType: attachment.entityType,
      entityId: attachment.entityId,
      // Название самого материала, а не объекта, к которому он привязан:
      // спрашивают «куда делись табы», а не «куда делся разбор»
      entityTitle: attachment.title,
      diff: { mediaAssetId: attachment.mediaAssetId },
    })

    revalidateMaterials(attachment.entityType as AttachmentTarget, publicPath)

    return { deleted: true }
  },
})

export const addExternalMaterialAction = defineAction({
  name: 'media.material.external',
  input: z.object({
    entityType: z.string(),
    entityId: z.uuid(),
    values: externalMaterialSchema,
    ...withPath,
  }),
  handler: async ({ entityType, entityId, values, publicPath }) => {
    const actorId = await actor()
    const target = requireAttachmentTarget(entityType)

    // Здесь тоже нужно право загружать: ссылка появляется в том же
    // списке материалов и для участника неотличима от файла
    await authorizeAttachmentTarget(actorId, target, entityId, { requireUpload: true })

    const attachmentId = await addExternalMaterial({
      entityType: target,
      entityId,
      values,
      uploadedBy: actorId,
    })

    revalidateMaterials(target, publicPath)

    return { attachmentId }
  },
})
