import { describe, expect, it } from 'vitest'

import {
  compareLevels,
  EMPTY_TEMPLATE,
  estimateLabel,
  formatDuration,
  isLevel,
  isPubliclyVisible,
  isTuning,
  LEVEL_VALUES,
  resolveSectionPlayback,
  SECTION_TEMPLATES,
  sectionDuration,
  sectionsFromTemplate,
  songSlug,
  totalDuration,
  tuningLabel,
  uniqueSlug,
} from './domain'

/**
 * Тесты правил разборов.
 *
 * Здесь проверяется то, что видит участник: какой кусок видео заиграет
 * при нажатии на часть, сколько длится разбор, виден ли он вообще.
 * Ошибка в любом из этих правил выглядит как сломанная платформа,
 * а не как неверное число в отчёте.
 */

describe('уровни', () => {
  it('идут от простого к сложному', () => {
    expect(LEVEL_VALUES).toEqual(['beginner', 'intermediate', 'advanced'])
  })

  it('сортируются в этом же порядке', () => {
    const shuffled = ['advanced', 'beginner', 'intermediate'] as const

    expect([...shuffled].sort(compareLevels)).toEqual(['beginner', 'intermediate', 'advanced'])
  })

  it('распознаются, а посторонние значения — нет', () => {
    expect(isLevel('beginner')).toBe(true)
    expect(isLevel('надёжный')).toBe(false)
    expect(isLevel(null)).toBe(false)
  })
})

describe('строй', () => {
  it('распознаётся из списка', () => {
    expect(isTuning('drop_d')).toBe(true)
    expect(isTuning('дроп ре')).toBe(false)
  })

  it('показывается человеку привычным написанием', () => {
    expect(tuningLabel('dadgad')).toBe('DADGAD')
    expect(tuningLabel(null)).toBeNull()
  })

  it('незнакомое значение показывается как есть, а не пропадает', () => {
    expect(tuningLabel('нестандартный')).toBe('нестандартный')
  })
})

describe('адрес разбора', () => {
  it('собирается из исполнителя и названия', () => {
    expect(songSlug('Metallica', 'Nothing Else Matters')).toBe('metallica-nothing-else-matters')
  })

  it('работает с кириллицей', () => {
    expect(songSlug('Кино', 'Пачка сигарет')).toBe('kino-pachka-sigaret')
  })

  it('исполнитель идёт первым — так адреса группируются', () => {
    const first = songSlug('Кино', 'Перемен')
    const second = songSlug('Кино', 'Пачка сигарет')

    expect(first.startsWith('kino-')).toBe(true)
    expect(second.startsWith('kino-')).toBe(true)
  })

  it('свободный адрес не меняется', () => {
    expect(uniqueSlug('kino-peremen', ['metallica-one'])).toBe('kino-peremen')
  })

  it('занятый получает числовой хвост', () => {
    expect(uniqueSlug('kino-peremen', ['kino-peremen'])).toBe('kino-peremen-2')
  })

  it('хвост растёт, пока адрес не освободится', () => {
    expect(uniqueSlug('kino-peremen', ['kino-peremen', 'kino-peremen-2'])).toBe('kino-peremen-3')
  })
})

describe('шаблоны структуры', () => {
  it('обычная песня даёт шесть частей', () => {
    expect(sectionsFromTemplate('standard')).toHaveLength(6)
  })

  it('каждый шаблон заканчивается сборкой целиком', () => {
    for (const template of ['standard', 'simple', 'fingerstyle'] as const) {
      expect(sectionsFromTemplate(template).at(-1)).toBe('Сборка целиком')
    }
  })

  it('возвращает копию: правка результата не портит шаблон', () => {
    const sections = sectionsFromTemplate('simple')
    sections.push('Лишнее')

    expect(sectionsFromTemplate('simple')).toHaveLength(3)
  })
})

describe('resolveSectionPlayback', () => {
  const common = 'asset-common'

  it('своё видео части важнее общего', () => {
    const result = resolveSectionPlayback(
      { videoAssetId: 'asset-own', videoStartSec: null, videoEndSec: null },
      common,
    )

    expect(result).toEqual({ assetId: 'asset-own', startSec: 0, endSec: null })
  })

  it('без своего видео берётся отрезок общего', () => {
    const result = resolveSectionPlayback(
      { videoAssetId: null, videoStartSec: 134, videoEndSec: 262 },
      common,
    )

    expect(result).toEqual({ assetId: common, startSec: 134, endSec: 262 })
  })

  it('без видео вовсе — проигрывать нечего, и это не ошибка', () => {
    const result = resolveSectionPlayback(
      { videoAssetId: null, videoStartSec: 10, videoEndSec: 20 },
      null,
    )

    expect(result).toBeNull()
  })

  it('начало по умолчанию — с нуля', () => {
    const result = resolveSectionPlayback(
      { videoAssetId: null, videoStartSec: null, videoEndSec: null },
      common,
    )

    expect(result?.startSec).toBe(0)
  })
})

describe('длительность', () => {
  it('берётся явная, если она указана', () => {
    expect(
      sectionDuration({
        durationSec: 200,
        videoAssetId: null,
        videoStartSec: 0,
        videoEndSec: 500,
      }),
    ).toBe(200)
  })

  it('иначе выводится из таймкодов', () => {
    expect(
      sectionDuration({
        durationSec: null,
        videoAssetId: null,
        videoStartSec: 134,
        videoEndSec: 262,
      }),
    ).toBe(128)
  })

  it('перепутанные местами таймкоды не дают отрицательной длины', () => {
    expect(
      sectionDuration({
        durationSec: null,
        videoAssetId: null,
        videoStartSec: 300,
        videoEndSec: 100,
      }),
    ).toBeNull()
  })

  it('сумма частей не спотыкается о неизвестные', () => {
    const sections = [
      { durationSec: 120, videoAssetId: null, videoStartSec: null, videoEndSec: null },
      { durationSec: null, videoAssetId: null, videoStartSec: null, videoEndSec: null },
      { durationSec: null, videoAssetId: null, videoStartSec: 0, videoEndSec: 60 },
    ]

    expect(totalDuration(sections)).toBe(180)
  })
})

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [5, '0:05'],
    [65, '1:05'],
    [222, '3:42'],
    [3600, '1:00:00'],
    [4350, '1:12:30'],
  ])('%i секунд → %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected)
  })

  it('не ломается на отрицательном значении', () => {
    expect(formatDuration(-10)).toBe('0:00')
  })
})

describe('estimateLabel', () => {
  it('минуты показываются минутами', () => {
    expect(estimateLabel(25)).toBe('около 25 мин.')
  })

  it('больше часа — в часах с половинками', () => {
    expect(estimateLabel(90)).toBe('около 1.5 ч.')
  })

  it('пустая оценка не превращается в «около 0 мин.»', () => {
    expect(estimateLabel(null)).toBeNull()
    expect(estimateLabel(0)).toBeNull()
  })
})

describe('isPubliclyVisible', () => {
  const now = new Date('2026-08-09T12:00:00Z')

  it('опубликованное видно', () => {
    expect(isPubliclyVisible('published', new Date('2026-01-01'), now)).toBe(true)
  })

  it('черновик не виден', () => {
    expect(isPubliclyVisible('draft', null, now)).toBe(false)
  })

  it('архив не виден', () => {
    expect(isPubliclyVisible('archived', new Date('2026-01-01'), now)).toBe(false)
  })

  it('запланированное на будущее ещё не видно', () => {
    expect(isPubliclyVisible('scheduled', new Date('2026-09-01'), now)).toBe(false)
  })

  it('запланированное открывается само, когда время пришло', () => {
    expect(isPubliclyVisible('scheduled', new Date('2026-08-09T11:59:00Z'), now)).toBe(true)
  })

  it('запланированное без даты не открывается никогда', () => {
    expect(isPubliclyVisible('scheduled', null, now)).toBe(false)
  })
})

describe('sectionsFromTemplate', () => {
  it('обычная песня даёт шесть частей', () => {
    expect(sectionsFromTemplate('standard')).toHaveLength(6)
  })

  it('неизвестный шаблон не ломает создание разбора', () => {
    // Значение приходит из браузера: «нет такого шаблона» должно означать
    // «без частей», а не падение при создании
    expect(sectionsFromTemplate('нет-такого')).toEqual([])
    expect(sectionsFromTemplate(EMPTY_TEMPLATE)).toEqual([])
  })

  it('у каждого шаблона есть подсказка: куратор выбирает не по названию', () => {
    for (const template of SECTION_TEMPLATES) {
      expect(template.hint.length).toBeGreaterThan(0)
    }
  })
})
