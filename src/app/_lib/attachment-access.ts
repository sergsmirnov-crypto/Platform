import 'server-only'

import { requirePermission } from '@/modules/access'
import { assertCanEditArrangement, assertCanEditSong } from '@/modules/songs/editor-service'
import { assertCanEditStream } from '@/modules/streams/editor-service'
import type { ContentEntity } from '@/shared/db/enums'
import { errors } from '@/shared/errors'

/**
 * Кто имеет право трогать материалы этого объекта.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ РЕЕСТР ЖИВЁТ В СЛОЕ ПРИЛОЖЕНИЯ
 *
 * Право положить таб к разбору — это право править ЭТОТ разбор, со всей
 * его областью «только свой контент». Знает об этом модуль разборов.
 * Модуль медиа знает, как хранятся файлы, и о разборах не подозревает.
 *
 * Свести их можно только здесь: слой приложения имеет право обращаться
 * к обоим модулям, а модули друг к другу — нет. Тот же приём уже
 * применён для привязки видео на шаге 5.5.
 *
 * Обещание сдержано: на шаге 7.3 эфиры добавились двумя строками —
 * видом в списке и веткой в проверке прав. Когда материалы понадобятся
 * урокам, будет так же.
 * ─────────────────────────────────────────────────────────────────
 */

/** Виды содержимого, к которым сегодня можно приложить материал */
const SUPPORTED_TARGETS = ['song', 'arrangement', 'stream'] as const

export type AttachmentTarget = (typeof SUPPORTED_TARGETS)[number]

export function isAttachmentTarget(value: unknown): value is AttachmentTarget {
  return typeof value === 'string' && (SUPPORTED_TARGETS as readonly string[]).includes(value)
}

/**
 * Приводит вид объекта из запроса к поддерживаемому.
 *
 * Курс и новости в перечислении базы уже есть, а материалов
 * у них пока нет. Молча принимать такой запрос значило бы позволить
 * положить файл в никуда.
 */
export function requireAttachmentTarget(value: ContentEntity | string | null): AttachmentTarget {
  if (!isAttachmentTarget(value)) {
    throw errors.validation({ entityType: 'К этому разделу материалы пока не прикладываются' })
  }

  return value
}

/**
 * Может ли этот человек менять материалы объекта.
 *
 * Бросает ошибку, если нет: молчаливый `false` пришлось бы проверять
 * в каждом вызове, и однажды проверку забыли бы.
 *
 * @param requireUpload дополнительно нужно право загружать файлы.
 *        Отделено от правки намеренно: переименовать и убрать материал
 *        со своего черновика куратор может всегда, а вот право класть
 *        новые файлы в хранилище выдаётся отдельно
 */
export async function authorizeAttachmentTarget(
  actorId: string,
  entityType: AttachmentTarget,
  entityId: string,
  options: { requireUpload?: boolean } = {},
): Promise<void> {
  if (options.requireUpload) {
    await requirePermission(actorId, 'media.upload')
  }

  switch (entityType) {
    case 'song':
      await assertCanEditSong(actorId, entityId)
      return
    case 'arrangement':
      await assertCanEditArrangement(actorId, entityId)
      return
    case 'stream':
      await assertCanEditStream(actorId, entityId)
      return
  }
}
