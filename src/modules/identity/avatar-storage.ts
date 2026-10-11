import 'server-only'

import { errors } from '@/shared/errors'
import { ImageProcessingError, toSquareWebp } from '@/shared/images/process-image'
import type { ImageProblem } from '@/shared/images/process-image'
import { getLogger } from '@/shared/logger'
import { getStorage } from '@/shared/storage'

import { AVATAR_CACHE_SECONDS, AVATAR_SIZE_KEYS, AVATAR_SIZES, avatarObjectKey } from './avatar'
import { identityStrings } from './strings'

/**
 * Файлы фотографии участника в хранилище.
 *
 * Единственное место, где встречаются три вещи: присланные байты,
 * библиотека обработки и хранилище. Всё остальное в модуле работает
 * с идентификатором фотографии и не знает, где она лежит физически.
 */

/** Причина отказа → объяснение для человека */
const PROBLEM_MESSAGES: Record<ImageProblem, string> = {
  unreadable: identityStrings.avatar.errors.unreadable,
  unsupported_format: identityStrings.avatar.errors.unsupportedFormat,
  too_small: identityStrings.avatar.errors.tooSmall,
}

/**
 * Готовит и сохраняет все размеры фотографии.
 *
 * Порядок важен: сначала готовятся все картинки и только потом
 * начинается запись. Если исходник окажется не изображением, в хранилище
 * не останется половины результата — участник увидел бы фотографию,
 * которая нормально открывается в профиле и ломается в шапке.
 */
export async function storeAvatarImage(
  userId: string,
  avatarId: string,
  source: Buffer,
): Promise<void> {
  let prepared: { key: string; body: Buffer }[]

  try {
    prepared = await Promise.all(
      AVATAR_SIZE_KEYS.map(async (size) => ({
        key: avatarObjectKey(userId, avatarId, size),
        body: await toSquareWebp(source, { size: AVATAR_SIZES[size] }),
      })),
    )
  } catch (error) {
    if (error instanceof ImageProcessingError) {
      // Ожидаемая ситуация, а не поломка: человек прислал не то.
      // Ответ приходит привязанным к полю, чтобы форма подсветила именно его
      throw errors.validation({ file: PROBLEM_MESSAGES[error.problem] })
    }

    throw error
  }

  const storage = getStorage()

  for (const item of prepared) {
    await storage.put({
      key: item.key,
      body: item.body,
      contentType: 'image/webp',
      visibility: 'public',
      cacheSeconds: AVATAR_CACHE_SECONDS,
    })
  }

  getLogger().info({ userId, bytes: source.length }, 'сохранена фотография участника')
}

/**
 * Убирает файлы фотографии из хранилища.
 *
 * Вызывается при замене и при удалении фотографии. Ошибки не гасит:
 * при явном удалении участник должен узнать, что оно не удалось.
 */
export async function removeAvatarFiles(userId: string, avatarId: string): Promise<void> {
  const storage = getStorage()

  for (const size of AVATAR_SIZE_KEYS) {
    await storage.delete(avatarObjectKey(userId, avatarId, size))
  }
}

/**
 * То же самое, но без последствий при неудаче.
 *
 * Нужно при замене фотографии: новая уже сохранена и записана в базу,
 * и обрывать успешное действие из-за того, что не удалось убрать старый
 * файл на сорок килобайт, — плохой обмен. Остаётся запись в журнале.
 */
export async function removeAvatarFilesQuietly(userId: string, avatarId: string): Promise<void> {
  try {
    await removeAvatarFiles(userId, avatarId)
  } catch (error) {
    getLogger().warn({ userId, avatarId, err: error }, 'не удалось убрать прежнюю фотографию')
  }
}
