import { describe, expect, it } from 'vitest'

import { UPLOAD_LIMITS } from '@/shared/storage/keys'

import {
  AVATAR_SIZES,
  avatarObjectKey,
  avatarObjectKeys,
  avatarUploadSchema,
  isBlobLike,
} from './avatar'

/**
 * Тесты правил фотографии профиля.
 *
 * Здесь проверяется то, от чего зависит либо безопасность, либо
 * работоспособность кэша: имена файлов и правила приёма. Ошибка в имени
 * означает перезапись чужого файла, ошибка в проверке — попадание
 * в хранилище того, что картинкой не является.
 */

const USER = '0198c0de-0000-7000-8000-000000000001'
const AVATAR = '0198c0de-1111-7000-8000-000000000002'

/** Подделка файла: настоящий Blob в тестах не нужен, проверяется договор */
function fakeFile(size: number, type: string): Blob {
  return { size, type, arrayBuffer: async () => new ArrayBuffer(0) } as unknown as Blob
}

describe('avatarObjectKey', () => {
  it('кладёт фотографию в публичный раздел', () => {
    expect(avatarObjectKey(USER, AVATAR, 'lg')).toMatch(/^public\/avatars\//)
  })

  it('раскладывает файлы по папкам участников', () => {
    expect(avatarObjectKey(USER, AVATAR, 'lg')).toContain(USER)
  })

  it('в имя входит размер — файлы разных размеров не перекрывают друг друга', () => {
    const large = avatarObjectKey(USER, AVATAR, 'lg')
    const small = avatarObjectKey(USER, AVATAR, 'sm')

    expect(large).not.toBe(small)
    expect(large).toContain(String(AVATAR_SIZES.lg))
    expect(small).toContain(String(AVATAR_SIZES.sm))
  })

  it('новая фотография получает другое имя — иначе кэш показывал бы старую', () => {
    const next = avatarObjectKey(USER, '0198c0de-2222-7000-8000-000000000003', 'lg')

    expect(next).not.toBe(avatarObjectKey(USER, AVATAR, 'lg'))
  })

  it('всегда заканчивается на .webp', () => {
    expect(avatarObjectKey(USER, AVATAR, 'sm').endsWith('.webp')).toBe(true)
  })

  it('обезвреживает попытку уйти в чужую папку', () => {
    const key = avatarObjectKey('../../secrets', AVATAR, 'lg')

    expect(key).not.toContain('..')
    expect(key.split('/')).toHaveLength(4)
  })
})

describe('avatarObjectKeys', () => {
  it('перечисляет все размеры — по этому списку удаляется старое фото', () => {
    const keys = avatarObjectKeys(USER, AVATAR)

    expect(keys).toHaveLength(Object.keys(AVATAR_SIZES).length)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('isBlobLike', () => {
  it('узнаёт файл по составу, а не по классу', () => {
    expect(isBlobLike(fakeFile(100, 'image/webp'))).toBe(true)
  })

  it.each([[null], [undefined], ['строка'], [42], [{}]])('отвергает %p', (value) => {
    expect(isBlobLike(value)).toBe(false)
  })
})

describe('avatarUploadSchema', () => {
  it('принимает картинку допустимого размера', () => {
    const result = avatarUploadSchema.safeParse({ file: fakeFile(200_000, 'image/webp') })

    expect(result.success).toBe(true)
  })

  it('достаёт файл из формы — именно так он приходит из браузера', () => {
    // Здесь нужен настоящий Blob: форма приводит к строке всё, что файлом
    // не является, и подделка проверила бы не то
    const form = new FormData()
    form.set('file', new Blob([new Uint8Array(2048)], { type: 'image/jpeg' }))

    expect(avatarUploadSchema.safeParse(form).success).toBe(true)
  })

  it('отвергает файл тяжелее допустимого', () => {
    const result = avatarUploadSchema.safeParse({
      file: fakeFile(UPLOAD_LIMITS.avatarBytes + 1, 'image/webp'),
    })

    expect(result.success).toBe(false)
  })

  it('отвергает пустой файл', () => {
    expect(avatarUploadSchema.safeParse({ file: fakeFile(0, 'image/webp') }).success).toBe(false)
  })

  it('отвергает SVG: внутри него может быть скрипт', () => {
    const result = avatarUploadSchema.safeParse({ file: fakeFile(1_000, 'image/svg+xml') })

    expect(result.success).toBe(false)
  })

  it('отвергает документ вместо фотографии', () => {
    expect(avatarUploadSchema.safeParse({ file: fakeFile(1_000, 'application/pdf') }).success).toBe(
      false,
    )
  })

  it('отвергает форму без файла', () => {
    expect(avatarUploadSchema.safeParse(new FormData()).success).toBe(false)
  })
})
