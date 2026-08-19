import { describe, expect, it } from 'vitest'

import {
  defaultMaterialTitle,
  describeUpload,
  externalMaterialSchema,
  externalProvider,
  fileExtension,
  materialTitleSchema,
  MAX_UPLOAD_BYTES,
  UPLOAD_ACCEPT,
} from './upload'

/**
 * Тесты правил приёма файлов.
 *
 * Проверяется не «расширения читаются», а то, ради чего эти правила
 * написаны: файл с чужим типом содержимого не проходит под своим типом,
 * имя с обходом папок не превращается в путь, а предел размера
 * соответствует виду файла, а не одному числу на всё.
 */

describe('fileExtension', () => {
  it('берёт расширение в нижнем регистре', () => {
    expect(fileExtension('Tabs.PDF')).toBe('pdf')
  })

  it('берёт последнее расширение у составного имени', () => {
    expect(fileExtension('archive.tar.gz')).toBe('gz')
  })

  it('не видит расширения у файла без точки', () => {
    expect(fileExtension('README')).toBe('')
  })

  it('не считает расширением скрытый файл', () => {
    expect(fileExtension('.gitignore')).toBe('')
  })

  it('игнорирует путь: браузер на Windows шлёт имя целиком', () => {
    expect(fileExtension('C:\\Users\\ivan\\Desktop\\tabs.gp5')).toBe('gp5')
  })

  it('точка в конце расширением не является', () => {
    expect(fileExtension('tabs.')).toBe('')
  })
})

describe('describeUpload', () => {
  it('узнаёт партитуру в PDF', () => {
    expect(describeUpload('nothing-else-matters.pdf')).toEqual({
      kind: 'pdf',
      extension: 'pdf',
      contentType: 'application/pdf',
      limitBytes: 25 * 1024 * 1024,
    })
  })

  it('узнаёт все версии Guitar Pro', () => {
    for (const name of ['a.gp', 'a.gp3', 'a.gp4', 'a.gp5', 'a.gpx', 'a.gtp']) {
      expect(describeUpload(name)?.kind).toBe('guitar_pro')
    }
  })

  it('у Guitar Pro предел строже, чем у PDF: формат компактный', () => {
    const guitarPro = describeUpload('a.gp5')
    const pdf = describeUpload('a.pdf')

    expect(guitarPro?.limitBytes).toBeLessThan(pdf?.limitBytes ?? 0)
  })

  it('у минусовки предел самый щедрый', () => {
    expect(describeUpload('backing.mp3')?.limitBytes).toBe(MAX_UPLOAD_BYTES)
  })

  it('принимает табы, снятые картинкой', () => {
    expect(describeUpload('scan.jpg')?.kind).toBe('image')
  })

  it('отвергает то, чего нет в списке', () => {
    for (const name of ['virus.exe', 'page.html', 'notes.txt', 'archive.zip']) {
      expect(describeUpload(name)).toBeNull()
    }
  })

  it('отвергает видео: ролики живут на видеохостинге, а не в хранилище', () => {
    expect(describeUpload('lesson.mp4')).toBeNull()
  })

  it('никогда не берёт тип содержимого из имени файла', () => {
    // Классический обход: файл называется картинкой, внутри разметка
    // со скриптом. Тип назначаем мы, и для .png это всегда image/png
    expect(describeUpload('payload.png')?.contentType).toBe('image/png')
  })

  it('не даёт подсунуть путь наружу через имя', () => {
    expect(describeUpload('../../etc/passwd')).toBeNull()
  })
})

describe('UPLOAD_ACCEPT', () => {
  it('перечисляет расширения с точкой', () => {
    expect(UPLOAD_ACCEPT).toContain('.pdf')
    expect(UPLOAD_ACCEPT).toContain('.gp5')
  })

  it('не содержит видео', () => {
    expect(UPLOAD_ACCEPT).not.toContain('.mp4')
  })
})

describe('defaultMaterialTitle', () => {
  it('берёт имя файла без расширения', () => {
    expect(defaultMaterialTitle('Nothing Else Matters — соло.pdf')).toBe(
      'Nothing Else Matters — соло',
    )
  })

  it('отбрасывает путь', () => {
    expect(defaultMaterialTitle('C:\\tabs\\solo.gp5')).toBe('solo')
  })

  it('оставляет имя целиком, если расширения нет', () => {
    expect(defaultMaterialTitle('README')).toBe('README')
  })

  it('не режет имя по точке внутри номера версии', () => {
    expect(defaultMaterialTitle('Прогулка 2.5.pdf')).toBe('Прогулка 2.5')
  })
})

describe('materialTitleSchema', () => {
  it('пустая строка превращается в отсутствие подписи', () => {
    expect(materialTitleSchema.parse('   ')).toBeNull()
  })

  it('обрезает пробелы по краям', () => {
    expect(materialTitleSchema.parse('  Табы  ')).toBe('Табы')
  })

  it('отвергает слишком длинную подпись', () => {
    expect(materialTitleSchema.safeParse('т'.repeat(200)).success).toBe(false)
  })
})

describe('externalMaterialSchema', () => {
  it('принимает адрес на https', () => {
    const result = externalMaterialSchema.safeParse({
      url: 'https://www.soundslice.com/slices/abc/',
      title: 'Интерактивные табы',
    })

    expect(result.success).toBe(true)
  })

  it('отвергает http: смешанное содержимое не откроется на странице', () => {
    expect(
      externalMaterialSchema.safeParse({ url: 'http://example.com/tabs', title: null }).success,
    ).toBe(false)
  })

  it('отвергает то, что адресом не является', () => {
    expect(externalMaterialSchema.safeParse({ url: 'соло на гитаре', title: null }).success).toBe(
      false,
    )
  })
})

describe('externalProvider', () => {
  it('узнаёт Soundslice', () => {
    expect(externalProvider('https://www.soundslice.com/slices/xyz/')).toBe('soundslice')
  })

  it('не путается в похожем имени', () => {
    expect(externalProvider('https://soundslice.com.evil.example/x')).toBe('external')
  })

  it('всё остальное считает просто внешним', () => {
    expect(externalProvider('https://example.com/tabs')).toBe('external')
  })
})
