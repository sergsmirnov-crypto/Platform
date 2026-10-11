import 'server-only'

import { serverEnv } from '@/shared/config/env.server'
import { getLogger } from '@/shared/logger'

import { createDisabledVideoProvider } from './disabled-provider'
import { createKinescopeProvider } from './kinescope-provider'

import type { VideoProvider } from './types'

/**
 * Выбор видеохостинга.
 *
 * Единственное место, где приложение узнаёт, какой поставщик используется.
 * Всё остальное работает с договором из `types.ts`, поэтому смена хостинга
 * — это новый файл рядом и значение в настройках, а не переделка страниц
 * (ARCHITECTURE §10).
 */

let cached: VideoProvider | null = null

export function getVideoProvider(): VideoProvider {
  if (cached) return cached

  if (serverEnv.VIDEO_PROVIDER === 'kinescope') {
    cached = createKinescopeProvider()
  } else {
    cached = createDisabledVideoProvider()
    getLogger().warn('видеохостинг не подключён: разборы открываются без видео')
  }

  return cached
}

/** Только для тестов: сбросить выбранного поставщика */
export function resetVideoProviderCache(): void {
  cached = null
}

export { issuePlaybackToken, verifyPlaybackToken } from './playback-token'
export type { PlaybackClaims } from './playback-token'

export type { PlaybackRequest, PlaybackSource, VideoProvider } from './types'
