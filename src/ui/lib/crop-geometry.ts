/**
 * Геометрия кадрирования.
 *
 * Чистая математика, без браузера и без React. Вынесена отдельно ровно
 * потому, что это единственная часть кадратора, где можно ошибиться
 * незаметно: рамка «почти правильная» выглядит нормально и портит
 * фотографию по краю. Тестами покрыто целиком.
 *
 * ─────────────────────────────────────────────────────────────────
 * МОДЕЛЬ
 *
 *   источник   — фотография, ширина × высота в её собственных точках
 *   окно       — квадрат на экране, сторона в точках экрана
 *   масштаб    — 1 означает «фотография ровно накрывает окно»
 *   смещение   — сдвиг центра фотографии от центра окна, в точках экрана
 *
 * Правило, из которого следует всё остальное: фотография обязана
 * накрывать окно целиком. Пустых углов быть не может, поэтому смещение
 * всегда зажимается в допустимые пределы.
 * ─────────────────────────────────────────────────────────────────
 */

export type Size = { width: number; height: number }
export type Offset = { x: number; y: number }

/** Прямоугольник в точках исходной фотографии */
export type CropRect = { left: number; top: number; width: number; height: number }

export const MIN_ZOOM = 1
export const MAX_ZOOM = 4

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return MIN_ZOOM

  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

/**
 * Во сколько раз уменьшить фотографию, чтобы она ровно накрыла окно.
 *
 * Берётся короткая сторона: по ней фотография впритык, по длинной —
 * с запасом, который и позволяет двигать кадр.
 */
export function coverScale(source: Size, viewport: number): number {
  const shortest = Math.min(source.width, source.height)

  if (shortest <= 0) return 1

  return viewport / shortest
}

/** Размер фотографии на экране при заданном увеличении */
export function displayedSize(source: Size, viewport: number, zoom: number): Size {
  const scale = coverScale(source, viewport) * clampZoom(zoom)

  return { width: source.width * scale, height: source.height * scale }
}

/**
 * Насколько далеко можно сдвинуть кадр, не открыв пустого угла.
 *
 * По оси, где фотография ровно по размеру окна, предел равен нулю —
 * сдвигать там нечего.
 */
export function maxOffset(source: Size, viewport: number, zoom: number): Offset {
  const displayed = displayedSize(source, viewport, zoom)

  return {
    x: Math.max(0, (displayed.width - viewport) / 2),
    y: Math.max(0, (displayed.height - viewport) / 2),
  }
}

export function clampOffset(offset: Offset, source: Size, viewport: number, zoom: number): Offset {
  const limit = maxOffset(source, viewport, zoom)

  return {
    x: Math.min(limit.x, Math.max(-limit.x, offset.x)),
    y: Math.min(limit.y, Math.max(-limit.y, offset.y)),
  }
}

/**
 * Что именно вырезать из исходной фотографии.
 *
 * Возвращает целые числа: дробные координаты холст всё равно округлит,
 * но уже по своим правилам, и результат разошёлся бы с тем, что человек
 * видел в окне.
 */
export function cropRect(source: Size, viewport: number, zoom: number, offset: Offset): CropRect {
  const scale = coverScale(source, viewport) * clampZoom(zoom)
  const displayed = displayedSize(source, viewport, zoom)
  const safeOffset = clampOffset(offset, source, viewport, zoom)

  const side = Math.round(viewport / scale)
  const left = Math.round((displayed.width - viewport) / 2 / scale - safeOffset.x / scale)
  const top = Math.round((displayed.height - viewport) / 2 / scale - safeOffset.y / scale)

  // Округление могло выйти за край на точку-другую. Возвращать такое
  // нельзя: холст в браузере на выход за границы отвечает пустой полосой
  const width = Math.min(side, source.width)
  const height = Math.min(side, source.height)

  return {
    left: Math.min(Math.max(0, left), source.width - width),
    top: Math.min(Math.max(0, top), source.height - height),
    width,
    height,
  }
}

/** Кадр по умолчанию: центральный квадрат целиком */
export function centeredSquare(source: Size): CropRect {
  const side = Math.min(source.width, source.height)

  return {
    left: Math.round((source.width - side) / 2),
    top: Math.round((source.height - side) / 2),
    width: side,
    height: side,
  }
}
