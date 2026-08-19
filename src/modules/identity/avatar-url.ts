import 'server-only'

import { getStorage } from '@/shared/storage'

import { avatarObjectKey } from './avatar'

import type { AvatarSize } from './avatar'

/**
 * Адрес фотографии участника.
 *
 * Вынесено в отдельный крошечный файл намеренно: этим занимается запросы
 * к базе, а рядом лежащая обработка изображений тянет за собой тяжёлую
 * библиотеку. Если бы всё жило в одном файле, эта библиотека загружалась
 * бы при каждой отрисовке любой страницы и в процессе фоновых задач,
 * где она не нужна вовсе.
 *
 * Когда фотографии нет, хранилище не спрашивается совсем — новая
 * установка платформы работает, даже если хранилище ещё не настроено.
 */
export function avatarUrlFor(
  userId: string,
  avatarId: string | null,
  size: AvatarSize,
): string | null {
  if (!avatarId) return null

  return getStorage().getPublicUrl(avatarObjectKey(userId, avatarId, size))
}
