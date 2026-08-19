import 'server-only'

import { clientEnv } from '@/shared/config/env.client'
import { isProduction, serverEnv } from '@/shared/config/env.server'
import { getLogger } from '@/shared/logger'

import { createLocalStorage, LOCAL_PUBLIC_PATH } from './local-provider'
import { createS3Storage } from './s3-provider'

import type { StorageProvider } from './types'

/**
 * Выбор хранилища.
 *
 * Единственное место, где приложение узнаёт, какой поставщик используется.
 * Всё остальное работает с договором из `types.ts` и о разнице не знает —
 * поэтому переезд между провайдерами не задевает ни одной страницы.
 *
 * Поставщик создаётся один раз и переиспользуется: клиент S3 держит
 * соединения, и создавать его на каждый запрос — верный способ упереться
 * в лимит открытых сокетов на сервере с четырьмя гигабайтами памяти.
 */

let cached: StorageProvider | null = null

export function getStorage(): StorageProvider {
  if (cached) return cached

  if (serverEnv.STORAGE_PROVIDER === 's3') {
    // Значения проверены при запуске: до сюда мы доходим только если
    // весь набор настроек S3 заполнен
    cached = createS3Storage({
      endpoint: serverEnv.S3_ENDPOINT as string,
      region: serverEnv.S3_REGION as string,
      bucket: serverEnv.S3_BUCKET as string,
      accessKeyId: serverEnv.S3_ACCESS_KEY_ID as string,
      secretAccessKey: serverEnv.S3_SECRET_ACCESS_KEY as string,
      publicBaseUrl: serverEnv.S3_PUBLIC_URL as string,
    })
  } else {
    if (isProduction) {
      // Дублирует проверку настроек: она может быть пропущена во время
      // сборки, а эта ветка выполняется уже на живом сервере
      throw new Error('Локальное хранилище файлов недопустимо в производственной среде')
    }

    cached = createLocalStorage(`${clientEnv.appUrl}${LOCAL_PUBLIC_PATH}`)
    getLogger().warn('файлы сохраняются в папку .storage на диске — только для разработки')
  }

  return cached
}

export { LOCAL_PUBLIC_PATH } from './local-provider'
export {
  buildKey,
  extensionForImage,
  IMAGE_CONTENT_TYPES,
  isAllowedImageType,
  isWithinLimit,
  sanitizeSegment,
  UPLOAD_LIMITS,
  visibilityFromKey,
} from './keys'
export type { ImageContentType } from './keys'
export type {
  FileVisibility,
  PutFileInput,
  SignedUrlOptions,
  StorageProvider,
  StoredFile,
} from './types'
