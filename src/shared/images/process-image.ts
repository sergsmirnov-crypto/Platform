import sharp from 'sharp'

import type { Metadata } from 'sharp'

/**
 * Обработка изображений, присланных участниками.
 *
 * ─────────────────────────────────────────────────────────────────
 * ГЛАВНАЯ МЫСЛЬ: КАРТИНКА НЕ ПРОВЕРЯЕТСЯ, А ПЕРЕСОБИРАЕТСЯ.
 *
 * Проверять присланный файл бессмысленно: расширение подделывается,
 * заголовок MIME присылает браузер, а внутрь картинки можно дописать
 * что угодно. Поэтому исходный файл не сохраняется никогда. Из него
 * читаются только пиксели, а на выходе получается новый файл, собранный
 * нами. Всё, что было внутри, — координаты съёмки, модель камеры,
 * встроенные скрипты, лишние кадры — до хранилища не доезжает.
 * ─────────────────────────────────────────────────────────────────
 *
 * Здесь нет `server-only`, хотя файл серверный. Причина практическая:
 * пакет `server-only` не даёт запустить модуль вне Next.js, и тогда
 * этот код нельзя было бы покрыть тестами. Защита обеспечивается иначе —
 * файл импортируется только из модулей, которые `server-only` объявляют,
 * а сама библиотека обработки в браузере не собирается в принципе.
 */

/** Какие форматы принимаем на вход. WebP тоже: его присылает наш кадратор */
const ACCEPTED_FORMATS = new Set(['jpeg', 'jpg', 'png', 'webp'])

/**
 * Ограничение на число точек в исходнике.
 *
 * Защита от «картинки-бомбы»: файл весит 30 килобайт, а развёрнутый
 * в память занимает десятки гигабайт и кладёт сервер. 40 мегапикселей —
 * заведомо больше любой телефонной фотографии.
 */
export const MAX_INPUT_PIXELS = 40_000_000

/** Меньше этого — не фотография, а иконка. Растягивать её бессмысленно */
export const MIN_INPUT_DIMENSION = 64

/** Что именно не так с присланным файлом */
export type ImageProblem = 'unreadable' | 'unsupported_format' | 'too_small'

/**
 * Ошибка обработки.
 *
 * Несёт причину кодом, а не текстом: текст для участника подбирает тот
 * модуль, который вызвал обработку. Общая инфраструктура не должна знать
 * формулировок интерфейса — иначе при переводе платформы искать их
 * пришлось бы по всему проекту.
 */
export class ImageProcessingError extends Error {
  readonly problem: ImageProblem

  constructor(problem: ImageProblem, cause?: unknown) {
    super(`Изображение не удалось обработать: ${problem}`, { cause })
    this.name = 'ImageProcessingError'
    this.problem = problem
  }
}

export type ImageInfo = {
  format: string
  width: number
  height: number
}

function open(input: Buffer) {
  return sharp(input, {
    limitInputPixels: MAX_INPUT_PIXELS,
    // Из анимированного файла берём только первый кадр: аватар —
    // это фотография, а не мультфильм в списке участников
    animated: false,
  })
}

/**
 * Читает размеры и формат, попутно убеждаясь, что это вообще картинка.
 *
 * Отдельный шаг перед преобразованием: так понятная ошибка «это не
 * изображение» появляется до того, как будет потрачена память на
 * разворачивание пикселей.
 */
export async function readImageInfo(input: Buffer): Promise<ImageInfo> {
  let metadata: Metadata

  try {
    metadata = await open(input).metadata()
  } catch (error) {
    throw new ImageProcessingError('unreadable', error)
  }

  const { format, width, height } = metadata

  if (!format || !ACCEPTED_FORMATS.has(format)) {
    throw new ImageProcessingError('unsupported_format')
  }

  if (!width || !height) {
    throw new ImageProcessingError('unreadable')
  }

  if (width < MIN_INPUT_DIMENSION || height < MIN_INPUT_DIMENSION) {
    throw new ImageProcessingError('too_small')
  }

  return { format, width, height }
}

export type SquareImageOptions = {
  /** Сторона квадрата на выходе, в точках */
  size: number
  /** 1–100. Ниже 70 на фотографиях лиц появляются заметные артефакты */
  quality?: number
}

/**
 * Собирает из присланного файла квадратную картинку в формате WebP.
 *
 * WebP выбран потому, что при одинаковом качестве весит примерно на треть
 * меньше JPEG и поддерживается всеми браузерами уже много лет. Единый
 * формат на выходе означает, что все остальные части платформы
 * не разбираются, что именно загрузил участник.
 *
 * Если картинка не квадратная — берётся центральный квадрат. В обычном
 * ходе дела этого не происходит: кадрирование делает браузер, и сюда
 * приходит готовый квадрат. Но обратиться к серверу можно и минуя
 * интерфейс, поэтому запасное поведение должно быть разумным.
 */
export async function toSquareWebp(input: Buffer, options: SquareImageOptions): Promise<Buffer> {
  await readImageInfo(input)

  try {
    return await open(input)
      // Разворот по метке ориентации из фотоаппарата. Делается до того,
      // как метки будут отброшены, иначе снимок с телефона окажется
      // повёрнутым набок
      .rotate()
      .resize(options.size, options.size, { fit: 'cover', position: 'centre' })
      .webp({ quality: options.quality ?? 82, effort: 4 })
      .toBuffer()
  } catch (error) {
    throw new ImageProcessingError('unreadable', error)
  }
}
