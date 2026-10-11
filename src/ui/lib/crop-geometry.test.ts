import { describe, expect, it } from 'vitest'

import {
  centeredSquare,
  clampOffset,
  clampZoom,
  coverScale,
  cropRect,
  MAX_ZOOM,
  maxOffset,
  MIN_ZOOM,
} from './crop-geometry'

/**
 * Тесты геометрии кадрирования.
 *
 * Главное, что здесь проверяется, — рамка никогда не выходит за края
 * фотографии. Выход за край браузер рисует пустой полосой, и участник
 * получил бы аватар с белым срезом вместо подбородка.
 */

const LANDSCAPE = { width: 1200, height: 800 }
const PORTRAIT = { width: 800, height: 1200 }
const SQUARE = { width: 1000, height: 1000 }
const VIEWPORT = 320

describe('clampZoom', () => {
  it('держит увеличение в допустимых пределах', () => {
    expect(clampZoom(0.2)).toBe(MIN_ZOOM)
    expect(clampZoom(99)).toBe(MAX_ZOOM)
    expect(clampZoom(2.5)).toBe(2.5)
  })

  it('не ломается на мусорном значении', () => {
    expect(clampZoom(Number.NaN)).toBe(MIN_ZOOM)
  })
})

describe('coverScale', () => {
  it('считает по короткой стороне — иначе останется пустой угол', () => {
    expect(coverScale(LANDSCAPE, VIEWPORT)).toBeCloseTo(VIEWPORT / 800)
    expect(coverScale(PORTRAIT, VIEWPORT)).toBeCloseTo(VIEWPORT / 800)
  })
})

describe('maxOffset', () => {
  it('у горизонтальной фотографии двигается только по горизонтали', () => {
    const limit = maxOffset(LANDSCAPE, VIEWPORT, 1)

    expect(limit.x).toBeGreaterThan(0)
    expect(limit.y).toBe(0)
  })

  it('у квадратной при обычном масштабе не двигается вовсе', () => {
    expect(maxOffset(SQUARE, VIEWPORT, 1)).toEqual({ x: 0, y: 0 })
  })

  it('увеличение даёт свободу движения по обеим осям', () => {
    const limit = maxOffset(SQUARE, VIEWPORT, 2)

    expect(limit.x).toBeGreaterThan(0)
    expect(limit.y).toBeGreaterThan(0)
  })
})

describe('clampOffset', () => {
  it('не пускает кадр за край', () => {
    const limit = maxOffset(LANDSCAPE, VIEWPORT, 1)
    const clamped = clampOffset({ x: 10_000, y: 10_000 }, LANDSCAPE, VIEWPORT, 1)

    expect(clamped.x).toBe(limit.x)
    expect(clamped.y).toBe(0)
  })

  it('оставляет допустимое смещение как есть', () => {
    expect(clampOffset({ x: 5, y: 0 }, LANDSCAPE, VIEWPORT, 1)).toEqual({ x: 5, y: 0 })
  })
})

describe('cropRect', () => {
  it('без сдвига берёт центральный квадрат', () => {
    const rect = cropRect(LANDSCAPE, VIEWPORT, 1, { x: 0, y: 0 })

    expect(rect).toEqual(centeredSquare(LANDSCAPE))
  })

  it('квадрат остаётся квадратом', () => {
    const rect = cropRect(PORTRAIT, VIEWPORT, 1.7, { x: 12, y: -30 })

    expect(rect.width).toBe(rect.height)
  })

  it('увеличение уменьшает вырезаемую область', () => {
    const normal = cropRect(SQUARE, VIEWPORT, 1, { x: 0, y: 0 })
    const zoomed = cropRect(SQUARE, VIEWPORT, 2, { x: 0, y: 0 })

    expect(zoomed.width).toBeLessThan(normal.width)
    expect(zoomed.width).toBeCloseTo(normal.width / 2, 0)
  })

  it('сдвиг вправо берёт кадр левее', () => {
    const centered = cropRect(LANDSCAPE, VIEWPORT, 1, { x: 0, y: 0 })
    const moved = cropRect(LANDSCAPE, VIEWPORT, 1, { x: 40, y: 0 })

    expect(moved.left).toBeLessThan(centered.left)
  })

  it.each([
    ['горизонтальная', LANDSCAPE],
    ['вертикальная', PORTRAIT],
    ['квадратная', SQUARE],
  ])('никогда не выходит за края: %s', (_name, source) => {
    for (const zoom of [1, 1.3, 2.2, MAX_ZOOM]) {
      for (const offset of [
        { x: 0, y: 0 },
        { x: 9999, y: 9999 },
        { x: -9999, y: -9999 },
        { x: 9999, y: -9999 },
      ]) {
        const rect = cropRect(source, VIEWPORT, zoom, offset)

        expect(rect.left).toBeGreaterThanOrEqual(0)
        expect(rect.top).toBeGreaterThanOrEqual(0)
        expect(rect.left + rect.width).toBeLessThanOrEqual(source.width)
        expect(rect.top + rect.height).toBeLessThanOrEqual(source.height)
        expect(rect.width).toBeGreaterThan(0)
      }
    }
  })
})

describe('centeredSquare', () => {
  it('вырезает самый большой возможный квадрат', () => {
    expect(centeredSquare(LANDSCAPE)).toEqual({ left: 200, top: 0, width: 800, height: 800 })
    expect(centeredSquare(PORTRAIT)).toEqual({ left: 0, top: 200, width: 800, height: 800 })
  })
})
