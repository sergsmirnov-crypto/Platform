import { readFile } from 'node:fs/promises'

import { isProduction } from '@/shared/config/env.server'
import { localFilePath } from '@/shared/storage/local-provider'

/**
 * Раздача файлов из локального хранилища.
 *
 * Существует только для разработки: заменяет собой сеть доставки, чтобы
 * загруженный аватар было видно на странице без облачного хранилища.
 * В производственной сборке отвечает 404 — там файлы отдаёт CDN, минуя
 * наш сервер (ARCHITECTURE §2).
 */

const CONTENT_TYPES: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  pdf: 'application/pdf',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
}

export async function GET(_request: Request, context: { params: Promise<{ key: string[] }> }) {
  if (isProduction) return new Response(null, { status: 404 })

  const { key } = await context.params

  try {
    const file = await readFile(localFilePath(key.join('/')))
    const extension = key.at(-1)?.split('.').pop() ?? ''

    return new Response(new Uint8Array(file), {
      headers: {
        'Content-Type': CONTENT_TYPES[extension] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return new Response(null, { status: 404 })
  }
}
