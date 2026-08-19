import 'server-only'

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import type { PutFileInput, SignedUrlOptions, StorageProvider, StoredFile } from './types'

/**
 * Заголовок, задающий имя скачиваемого файла.
 *
 * Записывается двумя способами сразу: простым `filename` для старых
 * браузеров и `filename*` по RFC 5987 для остальных. Русские названия
 * табов иначе превращаются в «______.pdf»: в обычном `filename`
 * допустима только латиница.
 */
function contentDisposition(name: string, inline: boolean): string {
  const ascii = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '')
  const mode = inline ? 'inline' : 'attachment'

  return `${mode}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

/**
 * Хранилище в S3-совместимом сервисе: Selectel, Timeweb, Yandex Cloud.
 *
 * Берётся именно S3-совместимость, а не конкретный сервис: все российские
 * провайдеры объектного хранения говорят на этом языке, поэтому переезд
 * между ними — смена четырёх переменных окружения, без единой правки
 * в коде.
 *
 * `forcePathStyle` обязателен: провайдеры, кроме самой Amazon, ожидают
 * адрес вида `endpoint/bucket/key`, а не `bucket.endpoint/key`.
 */

type S3Config = {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  /**
   * Адрес, по которому публичные файлы доступны снаружи: сеть доставки
   * или сам endpoint. Отделён от endpoint намеренно — раздача обычно
   * идёт через CDN, а запись всегда напрямую в хранилище
   */
  publicBaseUrl: string
}

export function createS3Storage(config: S3Config): StorageProvider {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })

  const publicBase = config.publicBaseUrl.replace(/\/+$/, '')

  return {
    name: 's3',

    async put(input: PutFileInput): Promise<StoredFile> {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
          CacheControl:
            input.cacheSeconds === undefined
              ? undefined
              : `public, max-age=${input.cacheSeconds}, immutable`,
        }),
      )

      return {
        key: input.key,
        size: input.body.byteLength,
        contentType: input.contentType,
      }
    },

    async delete(key: string): Promise<void> {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }))
    },

    getPublicUrl(key: string): string {
      return `${publicBase}/${key}`
    },

    async getSignedUrl(
      key: string,
      expiresInSeconds: number,
      options?: SignedUrlOptions,
    ): Promise<string> {
      return getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: key,
          // Имя файла — часть подписи, поэтому подменить его,
          // поправив адрес, невозможно
          ...(options?.downloadName
            ? {
                ResponseContentDisposition: contentDisposition(
                  options.downloadName,
                  options.inline ?? false,
                ),
              }
            : {}),
        }),
        { expiresIn: expiresInSeconds },
      )
    },
  }
}
