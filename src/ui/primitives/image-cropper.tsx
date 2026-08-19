'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  clampOffset,
  clampZoom,
  cropRect,
  displayedSize,
  MAX_ZOOM,
  MIN_ZOOM,
} from '@/ui/lib/crop-geometry'
import type { CropRect, Offset } from '@/ui/lib/crop-geometry'

/**
 * Кадрирование изображения.
 *
 * Квадратное окно, внутри которого снимок можно двигать и приближать.
 * Наружу отдаёт только координаты кадра — сам снимок не трогает.
 * Поэтому компонент годится и для фотографии профиля, и для обложек
 * разборов, которые появятся дальше.
 *
 * Вся математика вынесена в `crop-geometry.ts` и покрыта тестами: здесь
 * остаются только события ввода. Разделение не декоративное — ошибку
 * в вычислении рамки в компоненте пришлось бы ловить глазами.
 *
 * Три способа управления, потому что люди разные и устройства тоже:
 * перетаскивание мышью или пальцем, щипок двумя пальцами, ползунок
 * масштаба со стрелками клавиатуры. Последний обязателен: без него
 * кадрирование недоступно тем, кто не пользуется мышью.
 */

type ImageCropperProps = {
  src: string
  naturalWidth: number
  naturalHeight: number
  /** Подпись ползунка масштаба */
  zoomLabel: string
  onChange: (rect: CropRect) => void
  /** Круглая подсказка поверх кадра — для фотографий профиля */
  round?: boolean
}

/** Насколько сдвигается кадр за одно нажатие стрелки */
const KEYBOARD_STEP = 12

export function ImageCropper({
  src,
  naturalWidth,
  naturalHeight,
  zoomLabel,
  onChange,
  round = false,
}: ImageCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState(0)
  const [zoom, setZoom] = useState(MIN_ZOOM)
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })

  const source = { width: naturalWidth, height: naturalHeight }

  /**
   * Обработчик в ссылке, а не в зависимостях.
   *
   * Родитель почти наверняка передаст сюда стрелочную функцию, которая
   * при каждой отрисовке новая. Попади она в зависимости — получился бы
   * бесконечный круг «сообщили об изменении → отрисовка → сообщили».
   */
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Размер окна нужен в точках, а задан он в разметке долей ширины.
  // Наблюдатель, а не однократное измерение: поворот телефона
  // и появление клавиатуры меняют ширину
  useEffect(() => {
    const element = containerRef.current
    if (!element) return

    const observer = new ResizeObserver(([entry]) => {
      if (entry) setViewport(entry.contentRect.width)
    })

    observer.observe(element)
    setViewport(element.clientWidth)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (viewport <= 0) return

    onChangeRef.current(cropRect(source, viewport, zoom, offset))
    // Пересчитываем при любом изменении кадра или размеров окна
  }, [viewport, zoom, offset, naturalWidth, naturalHeight]) // eslint-disable-line react-hooks/exhaustive-deps

  const moveBy = useCallback(
    (dx: number, dy: number) => {
      setOffset((current) =>
        clampOffset({ x: current.x + dx, y: current.y + dy }, source, viewport, zoom),
      )
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewport, zoom, naturalWidth, naturalHeight],
  )

  const changeZoom = useCallback(
    (next: number) => {
      const safe = clampZoom(next)
      setZoom(safe)
      setOffset((current) => clampOffset(current, source, viewport, safe))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewport, naturalWidth, naturalHeight],
  )

  /** Активные касания: одно — перетаскивание, два — щипок */
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null)

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointers.current.size === 2) {
      const [first, second] = [...pointers.current.values()]
      if (first && second) {
        pinchStart.current = {
          distance: Math.hypot(first.x - second.x, first.y - second.y),
          zoom,
        }
      }
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId)
    if (!previous) return

    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    if (pointers.current.size >= 2 && pinchStart.current) {
      const [first, second] = [...pointers.current.values()]
      if (!first || !second) return

      const distance = Math.hypot(first.x - second.x, first.y - second.y)
      changeZoom(pinchStart.current.zoom * (distance / pinchStart.current.distance))
      return
    }

    moveBy(event.clientX - previous.x, event.clientY - previous.y)
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [KEYBOARD_STEP, 0],
      ArrowRight: [-KEYBOARD_STEP, 0],
      ArrowUp: [0, KEYBOARD_STEP],
      ArrowDown: [0, -KEYBOARD_STEP],
    }

    const move = moves[event.key]
    if (!move) return

    event.preventDefault()
    moveBy(move[0], move[1])
  }

  const displayed = displayedSize(source, viewport, zoom)

  return (
    <div>
      <div
        ref={containerRef}
        role="application"
        aria-label="Область кадрирования: перетаскивание мышью или стрелками"
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        className="bg-surface-sunken relative aspect-square w-full cursor-grab touch-none overflow-hidden rounded-lg select-none active:cursor-grabbing"
      >
        {viewport > 0 ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              draggable={false}
              className="absolute top-1/2 left-1/2 max-w-none"
              style={{
                width: `${displayed.width}px`,
                height: `${displayed.height}px`,
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
              }}
            />

            {round ? (
              /*
               * Затемнение всего, что не попадёт в кадр. Огромная тень
               * внутрь — приём вместо второго слоя разметки: круг
               * вырезается сам собой, а щелчки проходят сквозь него
               */
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
              />
            ) : null}
          </>
        ) : null}
      </div>

      <label className="mt-4 flex items-center gap-3">
        <span className="text-content-muted text-sm">{zoomLabel}</span>
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(event) => changeZoom(Number(event.target.value))}
          className="accent-accent h-11 flex-1"
        />
      </label>
    </div>
  )
}
