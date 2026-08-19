import { describe, expect, it } from 'vitest'

import {
  canDownload,
  canViewInline,
  formatFileSize,
  isExternalKind,
  isFileKind,
  isMediaKind,
  isReady,
  kindLabel,
  materialTitle,
} from './domain'

describe('isMediaKind', () => {
  it('узнаёт известные виды', () => {
    expect(isMediaKind('pdf')).toBe(true)
  })

  it('отвергает выдуманные', () => {
    expect(isMediaKind('партитура')).toBe(false)
    expect(isMediaKind(null)).toBe(false)
  })
})

describe('isFileKind', () => {
  it('видео файлом не считается', () => {
    expect(isFileKind('video')).toBe(false)
  })

  it('остальное считается', () => {
    expect(isFileKind('pdf')).toBe(true)
    expect(isFileKind('guitar_pro')).toBe(true)
  })
})

describe('canDownload', () => {
  it('видео не скачивается никогда', () => {
    // Ради этого и выбирается видеохостинг (PRD v0.2 §2)
    expect(canDownload({ kind: 'video', isDownloadable: true })).toBe(false)
  })

  it('интерактивные табы не скачиваются: это чужая страница, а не файл', () => {
    expect(canDownload({ kind: 'interactive_tab', isDownloadable: true })).toBe(false)
    expect(isExternalKind('interactive_tab')).toBe(true)
  })

  it('файл скачивается, если куратор разрешил', () => {
    expect(canDownload({ kind: 'pdf', isDownloadable: true })).toBe(true)
  })

  it('файл не скачивается, если куратор запретил', () => {
    expect(canDownload({ kind: 'pdf', isDownloadable: false })).toBe(false)
  })
})

describe('kindLabel и materialTitle', () => {
  it('подпись куратора важнее вида файла', () => {
    expect(materialTitle('Табы для Drop D', 'pdf')).toBe('Табы для Drop D')
  })

  it('без подписи берётся название вида', () => {
    expect(materialTitle(null, 'guitar_pro')).toBe('Guitar Pro')
    expect(materialTitle('   ', 'audio')).toBe(kindLabel('audio'))
  })
})

describe('formatFileSize', () => {
  it('мелкие файлы показывает в килобайтах', () => {
    expect(formatFileSize(120 * 1024)).toBe('120 КБ')
  })

  it('крупные — в мегабайтах с одним знаком', () => {
    expect(formatFileSize(Math.round(2.4 * 1024 * 1024))).toBe('2.4 МБ')
  })

  it('от десяти мегабайт дробная часть не нужна', () => {
    expect(formatFileSize(42 * 1024 * 1024)).toBe('42 МБ')
  })

  it('неизвестный размер не выдумывает', () => {
    expect(formatFileSize(null)).toBeNull()
    expect(formatFileSize(0)).toBeNull()
  })
})

describe('isReady', () => {
  it('готов только полностью обработанный файл', () => {
    expect(isReady('ready')).toBe(true)
    expect(isReady('processing')).toBe(false)
    expect(isReady('failed')).toBe(false)
  })
})

describe('canViewInline', () => {
  it('PDF и картинки показываются рядом с видео', () => {
    expect(canViewInline('pdf')).toBe(true)
    expect(canViewInline('image')).toBe(true)
  })

  it('Guitar Pro показать нечем: это формат для программы', () => {
    expect(canViewInline('guitar_pro')).toBe(false)
  })

  it('минусовку и интерактивные табы рядом с видео не показываем', () => {
    expect(canViewInline('audio')).toBe(false)
    expect(canViewInline('interactive_tab')).toBe(false)
    expect(canViewInline('video')).toBe(false)
  })
})
