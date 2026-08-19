import type { FileVisibility } from './types'

/**
 * Имена файлов в хранилище и проверки при загрузке.
 *
 * Чистые функции: ни сети, ни диска. Поэтому покрыты тестами целиком —
 * а проверять здесь есть что. Имя файла, собранное из того, что прислал
 * браузер, — это классическая дыра: `../../` в названии уводит запись
 * в чужую папку, а `.svg` вместо картинки выполняет скрипт в браузере
 * того, кто его открыл.
 */

/** Что разрешено загружать в качестве изображения */
export const IMAGE_CONTENT_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const

/**
 * SVG в этом списке нет и не будет.
 *
 * SVG — это документ с разметкой, а не картинка: внутри может лежать
 * скрипт, который выполнится в браузере участника, открывшего чужой
 * аватар. Для фотографий он всё равно не нужен.
 */
export type ImageContentType = keyof typeof IMAGE_CONTENT_TYPES

/**
 * Ограничения на загружаемые файлы.
 *
 * Числа разные не для порядка: предел решает, что произойдёт при ошибке.
 * Слишком щедрый — и в закрытое хранилище уезжает часовое видео, которому
 * место на видеохостинге. Слишком скупой — и куратор не может положить
 * партитуру, а объяснения «почему нельзя» не существует.
 */
export const UPLOAD_LIMITS = {
  /** Фотография профиля. Больше пяти мегабайт телефон и не снимет */
  avatarBytes: 5 * 1024 * 1024,
  /** Табы и материалы: партитура в PDF редко тяжелее */
  documentBytes: 25 * 1024 * 1024,
  /** Guitar Pro. Формат компактный: партитура целой песни — сотни килобайт */
  guitarProBytes: 5 * 1024 * 1024,
  /** Минусовка: пять минут в приличном качестве */
  audioBytes: 50 * 1024 * 1024,
  /** Табы, снятые картинкой. Такое приходит из Telegram чаще, чем хотелось бы */
  imageBytes: 10 * 1024 * 1024,
} as const

export function isAllowedImageType(contentType: string): contentType is ImageContentType {
  return contentType in IMAGE_CONTENT_TYPES
}

export function extensionForImage(contentType: ImageContentType): string {
  return IMAGE_CONTENT_TYPES[contentType]
}

/**
 * Приводит кусок имени к безопасному виду.
 *
 * Оставляем только латиницу, цифры, дефис и подчёркивание. Всё остальное,
 * включая точки и косые черты, превращается в дефис: точка позволила бы
 * подменить расширение, косая черта — уйти в соседнюю папку.
 */
export function sanitizeSegment(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')

  return cleaned.slice(0, 64)
}

/**
 * Полный путь файла в хранилище.
 *
 * Первым участком идёт вид доступа. Это не украшение: правило доступа
 * к хранилищу настраивается по префиксу, и файл, попавший не в ту папку,
 * либо не откроется, либо откроется всем. Держать вид доступа в пути —
 * значит видеть ошибку сразу, а не через месяц.
 */
export function buildKey(input: {
  visibility: FileVisibility
  /** Раздел: 'avatars', 'tabs', 'covers' */
  folder: string
  /** К чему относится файл: идентификатор участника или разбора */
  ownerId: string
  /** Уникальная часть, чтобы новый файл не перекрыл старый в кэше */
  uniquePart: string
  extension: string
}): string {
  const folder = sanitizeSegment(input.folder)
  const owner = sanitizeSegment(input.ownerId)
  const unique = sanitizeSegment(input.uniquePart)
  const extension = sanitizeSegment(input.extension)

  if (!folder || !owner || !unique || !extension) {
    throw new Error('Не удалось собрать имя файла: пустая часть пути')
  }

  return `${input.visibility}/${folder}/${owner}/${unique}.${extension}`
}

/** Вид доступа, зашитый в путь. Нужен при удалении и выдаче ссылки */
export function visibilityFromKey(key: string): FileVisibility | null {
  if (key.startsWith('public/')) return 'public'
  if (key.startsWith('private/')) return 'private'
  return null
}

/**
 * Помещается ли файл в разрешённый размер.
 *
 * Проверяется до записи в хранилище, а не после: иначе оплачивается
 * трафик за файл, который всё равно будет отвергнут.
 */
export function isWithinLimit(sizeBytes: number, limitBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= limitBytes
}
