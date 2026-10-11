import { describe, expect, it } from 'vitest'

import { NOTIFICATION_CATALOG, NOTIFICATION_LIST } from './catalog'
import {
  buildDigestText,
  formatUnreadBadge,
  isEnabledFor,
  isImmediate,
  resolvePreferences,
} from './rules'

describe('каталог типов', () => {
  it('ничего не выключено по умолчанию', () => {
    // Человек, не желающий знать о новых разборах, выключит их сам.
    // Человек, который хочет знать, выключенную настройку не найдёт
    expect(NOTIFICATION_LIST.every((item) => item.defaultEnabled)).toBe(true)
  })

  it('предупреждение о подписке отключить нельзя', () => {
    expect(NOTIFICATION_CATALOG['subscription.expiring'].canDisable).toBe(false)
  })

  it('всё про содержимое уходит в сводку, а не отдельными сообщениями', () => {
    expect(NOTIFICATION_CATALOG['song.published'].delivery).toBe('digest')
    expect(NOTIFICATION_CATALOG['stream.recorded'].delivery).toBe('digest')
  })
})

describe('resolvePreferences', () => {
  it('без настроек всё по каталогу', () => {
    const resolved = resolvePreferences([])

    expect(resolved).toHaveLength(NOTIFICATION_LIST.length)
    expect(resolved.every((item) => item.enabled)).toBe(true)
    expect(resolved.every((item) => !item.isOverridden)).toBe(true)
  })

  it('личный отказ выключает тип и помечается как отклонение', () => {
    const resolved = resolvePreferences([{ type: 'song.published', enabled: false }])
    const songs = resolved.find((item) => item.key === 'song.published')

    expect(songs?.enabled).toBe(false)
    expect(songs?.isOverridden).toBe(true)
  })

  it('настройка, совпадающая с умолчанием, отклонением не считается', () => {
    const resolved = resolvePreferences([{ type: 'song.published', enabled: true }])

    expect(resolved.find((item) => item.key === 'song.published')?.isOverridden).toBe(false)
  })

  it('неотключаемый тип остаётся включённым, даже если в базе лежит отказ', () => {
    const resolved = resolvePreferences([{ type: 'subscription.expiring', enabled: false }])

    expect(resolved.find((item) => item.key === 'subscription.expiring')?.enabled).toBe(true)
  })

  it('настройка неизвестного типа не ломает открытие настроек', () => {
    expect(() =>
      resolvePreferences([{ type: 'club.carrier_pigeon', enabled: false }]),
    ).not.toThrow()
    expect(resolvePreferences([{ type: 'club.carrier_pigeon', enabled: false }])).toHaveLength(
      NOTIFICATION_LIST.length,
    )
  })
})

describe('isEnabledFor', () => {
  it('учитывает личный отказ', () => {
    expect(isEnabledFor('song.published', [])).toBe(true)
    expect(isEnabledFor('song.published', [{ type: 'song.published', enabled: false }])).toBe(false)
  })
})

describe('isImmediate', () => {
  it('срочное — только то, где промедление меняет смысл', () => {
    expect(isImmediate('stream.reminder')).toBe(true)
    expect(isImmediate('subscription.expiring')).toBe(true)
    expect(isImmediate('song.published')).toBe(false)
  })
})

describe('buildDigestText', () => {
  it('пустая сводка не отправляется', () => {
    expect(buildDigestText([], 'https://club.example')).toBeNull()
  })

  it('одна новость идёт как есть, без слова «сводка»', () => {
    const text = buildDigestText(
      [{ type: 'song.published', title: 'Новый разбор: Nothing Else Matters' }],
      'https://club.example',
    )

    expect(text).toContain('Nothing Else Matters')
    expect(text).not.toContain('Что нового')
    expect(text).not.toContain('•')
  })

  it('несколько новостей собираются в одно сообщение списком', () => {
    const text =
      buildDigestText(
        [
          { type: 'song.published', title: 'Разбор один' },
          { type: 'song.published', title: 'Разбор два' },
          { type: 'stream.recorded', title: 'Запись эфира' },
        ],
        'https://club.example',
      ) ?? ''

    expect(text.split('•')).toHaveLength(4)
    expect(text).toContain('Что нового')
    expect(text).toContain('https://club.example')
  })
})

describe('formatUnreadBadge', () => {
  it('ноль не показывается', () => {
    expect(formatUnreadBadge(0)).toBeNull()
    expect(formatUnreadBadge(-1)).toBeNull()
  })

  it('обычное число показывается как есть', () => {
    expect(formatUnreadBadge(7)).toBe('7')
  })

  it('за пределом точность уже не нужна', () => {
    expect(formatUnreadBadge(100)).toBe('99+')
    expect(formatUnreadBadge(5, 3)).toBe('3+')
  })
})
