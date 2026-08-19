import 'server-only'

import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

import type { PutFileInput, StorageProvider, StoredFile } from './types'

/**
 * Хранилище на диске машины разработчика.
 *
 * Существует по одной причине: поднять проект локально должно быть можно
 * без учётной записи в облаке. Требование «сначала заведи S3, потом
 * запусти» отсекает и нового разработчика, и владельца платформы,
 * который просто хочет посмотреть, что получилось.
 *
 * ⚠️ Только для разработки. В производственной сборке выбор этого
 * поставщика приводит к отказу запуска — см. `index.ts`. Здесь нет
 * ни ограничения доступа, ни подписанных ссылок: закрытый файл отдаётся
 * так же, как публичный.
 */

/** Куда складываются файлы. Папка добавлена в `.gitignore` */
const ROOT = resolve(process.cwd(), '.storage')

export function createLocalStorage(publicBaseUrl: string): StorageProvider {
  const base = publicBaseUrl.replace(/\/+$/, '')

  function pathFor(key: string): string {
    // Ключи собираются в `keys.ts` и уже обезврежены, но проверка
    // повторяется здесь: файл, записанный мимо папки, — слишком дорогая
    // ошибка, чтобы полагаться на одну проверку в другом месте
    const target = resolve(ROOT, key)
    if (!target.startsWith(ROOT)) {
      throw new Error('Недопустимое имя файла')
    }
    return target
  }

  return {
    name: 'local',

    async put(input: PutFileInput): Promise<StoredFile> {
      const target = pathFor(input.key)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, input.body)

      return {
        key: input.key,
        size: input.body.byteLength,
        contentType: input.contentType,
      }
    },

    async delete(key: string): Promise<void> {
      await rm(pathFor(key), { force: true })
    },

    getPublicUrl(key: string): string {
      return `${base}/${key}`
    },

    async getSignedUrl(key: string): Promise<string> {
      // Подписи нет: локально защищать нечего, а видимость поведения
      // важнее правдоподобия
      return `${base}/${key}`
    },
  }
}

/** Путь к файлу на диске — нужен служебному обработчику раздачи */
export function localFilePath(key: string): string {
  const target = resolve(ROOT, key)
  if (!target.startsWith(ROOT)) throw new Error('Недопустимое имя файла')
  return target
}

export const LOCAL_STORAGE_ROOT = ROOT
export const LOCAL_PUBLIC_PATH = join('/', 'api', 'dev-files')
