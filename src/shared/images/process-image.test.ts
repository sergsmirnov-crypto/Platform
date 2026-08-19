import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import {
  ImageProcessingError,
  MIN_INPUT_DIMENSION,
  readImageInfo,
  toSquareWebp,
} from './process-image'

/**
 * Тесты обработки изображений.
 *
 * Проверяется не «библиотека работает» — она работает и без нас, — а наши
 * правила: что принимается, что отвергается и что остаётся в файле после
 * пересборки. Последнее особенно важно: тест на исчезновение координат
 * съёмки — единственное, что подтверждает обещание не публиковать
 * местоположение участника вместе с его фотографией.
 */

async function makeImage(width: number, height: number, format: 'png' | 'jpeg' = 'png') {
  const image = sharp({
    create: { width, height, channels: 3, background: { r: 180, g: 140, b: 60 } },
  })

  return format === 'png' ? image.png().toBuffer() : image.jpeg().toBuffer()
}

describe('readImageInfo', () => {
  it('читает формат и размеры настоящей картинки', async () => {
    const info = await readImageInfo(await makeImage(1200, 800))

    expect(info).toEqual({ format: 'png', width: 1200, height: 800 })
  })

  it('отвергает файл, который картинкой не является', async () => {
    await expect(
      readImageInfo(Buffer.from('<svg><script>alert(1)</script></svg>')),
    ).rejects.toEqual(expect.objectContaining({ problem: 'unreadable' }))
  })

  it('отвергает пустой файл', async () => {
    await expect(readImageInfo(Buffer.alloc(0))).rejects.toBeInstanceOf(ImageProcessingError)
  })

  it('отвергает картинку меньше допустимой стороны', async () => {
    const tiny = await makeImage(MIN_INPUT_DIMENSION - 1, MIN_INPUT_DIMENSION - 1)

    await expect(readImageInfo(tiny)).rejects.toEqual(
      expect.objectContaining({ problem: 'too_small' }),
    )
  })

  it('принимает картинку ровно допустимого минимума', async () => {
    const info = await readImageInfo(await makeImage(MIN_INPUT_DIMENSION, MIN_INPUT_DIMENSION))

    expect(info.width).toBe(MIN_INPUT_DIMENSION)
  })
})

describe('toSquareWebp', () => {
  it('на выходе всегда WebP заданной стороны', async () => {
    const result = await toSquareWebp(await makeImage(1200, 800), { size: 512 })
    const meta = await sharp(result).metadata()

    expect(meta.format).toBe('webp')
    expect(meta.width).toBe(512)
    expect(meta.height).toBe(512)
  })

  it('приводит к квадрату и вертикальную картинку', async () => {
    const result = await toSquareWebp(await makeImage(400, 1000), { size: 128 })
    const meta = await sharp(result).metadata()

    expect(meta.width).toBe(128)
    expect(meta.height).toBe(128)
  })

  it('меньший размер весит меньше', async () => {
    const source = await makeImage(1200, 1200, 'jpeg')

    const large = await toSquareWebp(source, { size: 512 })
    const small = await toSquareWebp(source, { size: 128 })

    expect(small.length).toBeLessThan(large.length)
  })

  it('стирает данные съёмки, включая координаты', async () => {
    const source = await sharp({
      create: { width: 600, height: 600, channels: 3, background: { r: 10, g: 10, b: 10 } },
    })
      .withExif({
        IFD0: { Model: 'iPhone', Copyright: 'Участник' },
        IFD2: { GPSLatitudeRef: 'N', GPSLongitudeRef: 'E' },
      })
      .jpeg()
      .toBuffer()

    // Убеждаемся, что подопытный файл действительно содержит метки:
    // иначе тест проходил бы, ничего не проверяя
    expect((await sharp(source).metadata()).exif).toBeDefined()

    const result = await toSquareWebp(source, { size: 256 })

    expect((await sharp(result).metadata()).exif).toBeUndefined()
  })

  it('отвергает не картинку, не создавая файла', async () => {
    await expect(toSquareWebp(Buffer.from('какой-то текст'), { size: 512 })).rejects.toBeInstanceOf(
      ImageProcessingError,
    )
  })
})
