import { describe, expect, it } from 'vitest'

import {
  buildKey,
  isAllowedImageType,
  isWithinLimit,
  sanitizeSegment,
  UPLOAD_LIMITS,
  visibilityFromKey,
} from './keys'

/**
 * Тесты имён файлов.
 *
 * Главное здесь — не удобство, а безопасность: имя, собранное из того,
 * что прислал браузер, при небрежном обращении уводит запись в чужую
 * папку. Если эти тесты когда-нибудь начнут падать, значит защита снята.
 */

describe('sanitizeSegment', () => {
  it('оставляет безопасные символы', () => {
    expect(sanitizeSegment('avatar_01-x')).toBe('avatar_01-x')
  })

  it('убирает попытку уйти на уровень выше', () => {
    expect(sanitizeSegment('../../etc/passwd')).toBe('etc-passwd')
  })

  it('обезвреживает подмену расширения точкой', () => {
    expect(sanitizeSegment('photo.php.jpg')).toBe('photo-php-jpg')
  })

  it('от имени без латиницы не остаётся ничего — и это осознанно', () => {
    // Пустой результат ловится в buildKey: лучше отказать в сохранении,
    // чем записать файл под именем из одних дефисов
    expect(sanitizeSegment('моё фото')).toBe('')
  })

  it('не оставляет дефисы по краям и подряд', () => {
    expect(sanitizeSegment('--a///b--')).toBe('a-b')
  })

  it('ограничивает длину', () => {
    expect(sanitizeSegment('a'.repeat(200))).toHaveLength(64)
  })
})

describe('buildKey', () => {
  it('собирает путь с видом доступа впереди', () => {
    const key = buildKey({
      visibility: 'public',
      folder: 'avatars',
      ownerId: '0199c1f0-0000-7000-8000-000000000001',
      uniquePart: 'ab12cd34',
      extension: 'webp',
    })

    expect(key).toBe('public/avatars/0199c1f0-0000-7000-8000-000000000001/ab12cd34.webp')
  })

  it('закрытые файлы попадают в свою папку', () => {
    const key = buildKey({
      visibility: 'private',
      folder: 'tabs',
      ownerId: 'song-1',
      uniquePart: 'v2',
      extension: 'pdf',
    })

    expect(key.startsWith('private/')).toBe(true)
  })

  it('не даёт вырваться из папки через имя раздела', () => {
    const key = buildKey({
      visibility: 'public',
      folder: '../private',
      ownerId: 'user-1',
      uniquePart: 'x',
      extension: 'webp',
    })

    expect(key).toBe('public/private/user-1/x.webp')
    expect(key.includes('..')).toBe(false)
  })

  it('отказывается собирать путь из пустых частей', () => {
    expect(() =>
      buildKey({
        visibility: 'public',
        folder: 'аватары',
        ownerId: 'user-1',
        uniquePart: 'x',
        extension: 'webp',
      }),
    ).toThrow()
  })
})

describe('visibilityFromKey', () => {
  it('распознаёт вид доступа', () => {
    expect(visibilityFromKey('public/avatars/a/b.webp')).toBe('public')
    expect(visibilityFromKey('private/tabs/a/b.pdf')).toBe('private')
  })

  it('чужой путь не относится ни к чему', () => {
    expect(visibilityFromKey('avatars/a/b.webp')).toBeNull()
  })
})

describe('isAllowedImageType', () => {
  it('принимает обычные форматы фотографий', () => {
    expect(isAllowedImageType('image/jpeg')).toBe(true)
    expect(isAllowedImageType('image/png')).toBe(true)
    expect(isAllowedImageType('image/webp')).toBe(true)
  })

  it('не принимает SVG: это документ со скриптом, а не картинка', () => {
    expect(isAllowedImageType('image/svg+xml')).toBe(false)
  })

  it('не принимает что попало', () => {
    expect(isAllowedImageType('application/pdf')).toBe(false)
    expect(isAllowedImageType('text/html')).toBe(false)
  })
})

describe('isWithinLimit', () => {
  it('пустой файл не принимается', () => {
    expect(isWithinLimit(0, UPLOAD_LIMITS.avatarBytes)).toBe(false)
  })

  it('файл в пределах ограничения принимается', () => {
    expect(isWithinLimit(1024, UPLOAD_LIMITS.avatarBytes)).toBe(true)
    expect(isWithinLimit(UPLOAD_LIMITS.avatarBytes, UPLOAD_LIMITS.avatarBytes)).toBe(true)
  })

  it('файл больше ограничения отвергается', () => {
    expect(isWithinLimit(UPLOAD_LIMITS.avatarBytes + 1, UPLOAD_LIMITS.avatarBytes)).toBe(false)
  })
})
