import { z } from 'zod'

import { buildKey, isAllowedImageType, UPLOAD_LIMITS } from '@/shared/storage/keys'

/**
 * Фотография участника: размеры, имена файлов, правила приёма.
 *
 * Только чистые правила — ни базы, ни хранилища, ни библиотеки обработки.
 * Поэтому файл целиком покрыт тестами и одинаково доступен серверу
 * и браузеру: форма проверяет размер снимка до отправки теми же числами,
 * какими сервер проверит его после.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ В БАЗЕ ЛЕЖИТ НЕ АДРЕС ФОТОГРАФИИ, А ЕЁ ИДЕНТИФИКАТОР
 *
 * Адрес складывается из настроек: сеть доставки, имя корзины, префикс.
 * Сохрани мы готовую ссылку — смена хранилища превратилась бы в ручную
 * правку строк в базе у каждого участника. Идентификатор от настроек
 * не зависит: адрес собирается на лету, переезд стоит одной переменной
 * окружения (ARCHITECTURE §10).
 * ─────────────────────────────────────────────────────────────────
 */

/**
 * Размеры, в которых хранится фотография.
 *
 * Два, а не один: на странице «Участники клуба» будет две с половиной
 * сотни фотографий, и разница между 128 и 512 точками — это десять
 * мегабайт против одного при каждом открытии списка.
 */
export const AVATAR_SIZES = {
  /** Шапка, списки участников, комментарии */
  sm: 128,
  /** Профиль, карточка участника, страница куратора */
  lg: 512,
} as const

export type AvatarSize = keyof typeof AVATAR_SIZES

export const AVATAR_SIZE_KEYS = Object.keys(AVATAR_SIZES) as AvatarSize[]

/** Раздел хранилища. Фотографии профилей — публичные, см. `avatarObjectKey` */
export const AVATAR_FOLDER = 'avatars'

export const AVATAR_EXTENSION = 'webp'

/**
 * Сколько браузеру и сети доставки разрешено держать фотографию у себя.
 *
 * Год — сознательно много. Это безопасно ровно потому, что при замене
 * фотографии меняется имя файла: старый адрес просто перестаёт
 * использоваться. Классическая беда «загрузил новое фото, а везде висит
 * старое» здесь невозможна технически.
 */
export const AVATAR_CACHE_SECONDS = 365 * 24 * 60 * 60

/**
 * До какой стороны браузер уменьшает снимок перед отправкой.
 *
 * Вдвое больше самого крупного хранимого размера — запас на то, чтобы
 * уменьшение делала библиотека на сервере, у которой это получается
 * лучше, чем у браузера. Отправлять исходный снимок с телефона
 * (5–10 мегабайт) незачем: из него всё равно останется квадрат 512×512.
 */
export const AVATAR_SOURCE_SIZE = 1024

/**
 * Имя файла фотографии в хранилище.
 *
 * Публичный раздел выбран осознанно. Фотография профиля — сведения малой
 * чувствительности, имя файла неугадываемо, а закрытая выдача означала бы
 * отказ от кэширования: список участников превратился бы в две с половиной
 * сотни обращений к нашему серверу при каждом открытии. Табы, материалы
 * и видео остаются закрытыми и отдаются только по временным ссылкам.
 */
export function avatarObjectKey(userId: string, avatarId: string, size: AvatarSize): string {
  return buildKey({
    visibility: 'public',
    folder: AVATAR_FOLDER,
    ownerId: userId,
    uniquePart: `${avatarId}-${AVATAR_SIZES[size]}`,
    extension: AVATAR_EXTENSION,
  })
}

/** Все файлы одной фотографии — для удаления при замене */
export function avatarObjectKeys(userId: string, avatarId: string): string[] {
  return AVATAR_SIZE_KEYS.map((size) => avatarObjectKey(userId, avatarId, size))
}

/**
 * Похоже ли значение на файл.
 *
 * Проверка по составу, а не через `instanceof`: файл проезжает через
 * границу «браузер — сервер», и по ту сторону это может оказаться другая
 * реализация того же самого. Строгая проверка типа отвергала бы
 * совершенно нормальную загрузку по причине, которую невозможно
 * объяснить участнику.
 */
export function isBlobLike(value: unknown): value is Blob {
  if (typeof value !== 'object' || value === null) return false

  const candidate = value as Partial<Blob>

  return (
    typeof candidate.size === 'number' &&
    typeof candidate.type === 'string' &&
    typeof candidate.arrayBuffer === 'function'
  )
}

export const avatarUploadErrors = {
  missing: 'Выберите фотографию',
  tooLarge: `Файл больше ${Math.round(UPLOAD_LIMITS.avatarBytes / 1024 / 1024)} МБ`,
  wrongType: 'Подойдёт JPEG, PNG или WebP',
} as const

const blobSchema = z
  .custom<Blob>(isBlobLike, { message: avatarUploadErrors.missing })
  .refine((file) => file.size > 0, { message: avatarUploadErrors.missing })
  .refine((file) => file.size <= UPLOAD_LIMITS.avatarBytes, {
    message: avatarUploadErrors.tooLarge,
  })
  .refine((file) => isAllowedImageType(file.type), { message: avatarUploadErrors.wrongType })

/**
 * Что принимает действие загрузки.
 *
 * Файл приезжает внутри `FormData` — это единственный способ передачи
 * двоичных данных, который поддерживается серверными действиями
 * при любой версии среды. Приведение к обычному объекту сделано здесь,
 * чтобы само действие работало с понятным `{ file }`, а не разбирало
 * форму руками.
 */
export const avatarUploadSchema = z.preprocess(
  (raw) => {
    if (typeof FormData !== 'undefined' && raw instanceof FormData) {
      return { file: raw.get('file') }
    }

    return raw
  },
  z.object({ file: blobSchema }),
)

export type AvatarUploadInput = z.infer<typeof avatarUploadSchema>
