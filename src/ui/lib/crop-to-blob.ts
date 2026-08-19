import type { CropRect } from './crop-geometry'

/**
 * Подготовка снимка к отправке средствами браузера.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗАЧЕМ ЭТО ДЕЛАЕТ БРАУЗЕР, А НЕ СЕРВЕР
 *
 *   1. Айфоны отдают снимки в формате HEIC. Сервер без отдельной
 *      библиотеки его не понимает, а сам айфон — прекрасно понимает,
 *      потому что это формат его же операционной системы. Прогон через
 *      холст превращает HEIC в обычную картинку бесплатно.
 *
 *   2. Снимок с телефона весит 5–10 мегабайт, а на выходе нужен квадрат
 *      512×512. Отправлять исходник — значит заставлять человека ждать
 *      на мобильном интернете ради данных, которые будут выброшены.
 *
 * Проверять картинку здесь никто не собирается: браузер участнику
 * не подчиняется только на словах. Настоящая проверка — на сервере,
 * где файл пересобирается заново.
 * ─────────────────────────────────────────────────────────────────
 */

/** Не удалось прочитать или обработать файл средствами браузера */
export class BrowserImageError extends Error {
  constructor(cause?: unknown) {
    super('Браузер не смог обработать изображение', { cause })
    this.name = 'BrowserImageError'
  }
}

/**
 * Загружает файл в объект изображения.
 *
 * Обычный `<img>`, а не более современные способы, выбран сознательно:
 * только он поворачивает снимок по метке ориентации от фотоаппарата.
 * Иначе снятое вертикально пришло бы на сервер лежащим набок.
 */
export function loadImageFromFile(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }

    image.onerror = (event) => {
      URL.revokeObjectURL(url)
      reject(new BrowserImageError(event))
    }

    image.src = url
  })
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality)
  })
}

export type CropToBlobOptions = {
  /** Сторона квадрата на выходе */
  size: number
  quality?: number
}

/**
 * Вырезает кадр и возвращает готовый к отправке файл.
 *
 * Формат — WebP, с откатом на JPEG. Откат нужен не «на всякий случай»:
 * браузер, не умеющий сохранять в WebP, молча сохранит в PNG, и снимок
 * распухнет в несколько раз. Поэтому результат проверяется по типу,
 * а не по факту получения.
 */
export async function cropToBlob(
  image: HTMLImageElement,
  rect: CropRect,
  options: CropToBlobOptions,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = options.size
  canvas.height = options.size

  const context = canvas.getContext('2d')
  if (!context) throw new BrowserImageError()

  // Сглаживание высокого качества заметно на портретах: без него
  // при сильном уменьшении появляется «лесенка» на волосах и глазах
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'

  context.drawImage(
    image,
    rect.left,
    rect.top,
    rect.width,
    rect.height,
    0,
    0,
    options.size,
    options.size,
  )

  const quality = options.quality ?? 0.9

  const webp = await toBlob(canvas, 'image/webp', quality)
  if (webp && webp.type === 'image/webp') return webp

  const jpeg = await toBlob(canvas, 'image/jpeg', quality)
  if (jpeg && jpeg.type === 'image/jpeg') return jpeg

  throw new BrowserImageError()
}
