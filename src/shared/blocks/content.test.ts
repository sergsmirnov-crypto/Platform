import { describe, expect, it } from 'vitest'

import { collectAssetIds, collectSongIds, hasReadableContent, parseContentBlocks } from './content'

/**
 * Тесты формата содержимого урока.
 *
 * Главное здесь не «JSON разбирается», а устойчивость: в базе может
 * лежать что угодно — запись прошлогодней версии, правка руками при
 * переносе, обрезанный при копировании массив. Урок обязан открыться
 * в любом из этих случаев.
 */

const ID = '0192f1a0-0000-7000-8000-000000000001'

describe('parseContentBlocks', () => {
  it('читает обычный урок', () => {
    const content = parseContentBlocks([
      { type: 'heading', text: 'Аккорд Am' },
      { type: 'paragraph', text: 'Ставим пальцы так.' },
    ])

    expect(content).toHaveLength(2)
    expect(content[0]).toEqual({ type: 'heading', text: 'Аккорд Am' })
  })

  it('подставляет значения по умолчанию', () => {
    const [block] = parseContentBlocks([{ type: 'list', items: ['раз', 'два'] }])

    expect(block).toEqual({ type: 'list', ordered: false, items: ['раз', 'два'] })
  })

  it('выбрасывает блок неизвестного вида, остальное сохраняет', () => {
    // Так выглядит урок, записанный будущей версией приложения
    const content = parseContentBlocks([
      { type: 'paragraph', text: 'Есть' },
      { type: 'карусель-из-будущего', text: 'Нет' },
      { type: 'paragraph', text: 'И это есть' },
    ])

    expect(content).toHaveLength(2)
  })

  it('выбрасывает блок с испорченными полями', () => {
    const content = parseContentBlocks([
      { type: 'paragraph' },
      { type: 'paragraph', text: '' },
      { type: 'image', assetId: 'не-идентификатор' },
      { type: 'paragraph', text: 'Уцелел' },
    ])

    expect(content).toEqual([{ type: 'paragraph', text: 'Уцелел' }])
  })

  it('не падает на том, что массивом не является', () => {
    // Испорченная запись не должна ронять страницу участнику
    for (const raw of [null, undefined, 'текст', 42, {}, { blocks: [] }]) {
      expect(parseContentBlocks(raw)).toEqual([])
    }
  })

  it('обрезает урок, раздутый до неприличия', () => {
    const many = Array.from({ length: 500 }, () => ({ type: 'paragraph', text: 'раз' }))

    expect(parseContentBlocks(many)).toHaveLength(200)
  })

  it('не пропускает слишком длинный текст', () => {
    expect(parseContentBlocks([{ type: 'paragraph', text: 'я'.repeat(5000) }])).toEqual([])
  })
})

describe('collectAssetIds', () => {
  it('собирает файлы картинок и видео без повторов', () => {
    const content = parseContentBlocks([
      { type: 'image', assetId: ID },
      { type: 'video', assetId: ID },
      { type: 'paragraph', text: 'текст' },
    ])

    expect(collectAssetIds(content)).toEqual([ID])
  })

  it('у урока без вложений список пуст', () => {
    expect(collectAssetIds(parseContentBlocks([{ type: 'paragraph', text: 'раз' }]))).toEqual([])
  })
})

describe('collectSongIds', () => {
  it('собирает упомянутые разборы', () => {
    const content = parseContentBlocks([{ type: 'song', songId: ID, note: 'Попробуй' }])

    expect(collectSongIds(content)).toEqual([ID])
  })
})

describe('hasReadableContent', () => {
  it('урок из одного видео читать нечего', () => {
    expect(hasReadableContent(parseContentBlocks([{ type: 'video', assetId: ID }]))).toBe(false)
  })

  it('урок с абзацем читать есть что', () => {
    expect(hasReadableContent(parseContentBlocks([{ type: 'paragraph', text: 'раз' }]))).toBe(true)
  })

  it('пустой урок читать нечего', () => {
    expect(hasReadableContent([])).toBe(false)
  })
})
