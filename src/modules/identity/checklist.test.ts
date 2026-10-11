import { describe, expect, it } from 'vitest'

import {
  CHECKLIST_TOTAL,
  checklistItems,
  completedCount,
  isChecklistVisible,
  isJustCompleted,
} from './checklist'

import type { ChecklistFacts } from './checklist'

function facts(overrides: Partial<ChecklistFacts> = {}): ChecklistFacts {
  return {
    hasOwnAvatar: false,
    openedSong: false,
    startedCourse: false,
    watchedStream: false,
    openedChat: false,
    hiddenByUser: false,
    ...overrides,
  }
}

function allDone(): ChecklistFacts {
  return facts({
    hasOwnAvatar: true,
    openedSong: true,
    startedCourse: true,
    watchedStream: true,
    openedChat: true,
  })
}

describe('состав списка', () => {
  it('пунктов пять', () => {
    expect(checklistItems(facts())).toHaveLength(CHECKLIST_TOTAL)
    expect(CHECKLIST_TOTAL).toBe(5)
  })

  it('первым идёт разбор: к показу списка он обычно уже выполнен', () => {
    expect(checklistItems(facts())[0]?.key).toBe('song')
  })

  it('фотография последняя: она дольше всех остаётся невыполненной', () => {
    const items = checklistItems(facts())
    expect(items[items.length - 1]?.key).toBe('avatar')
  })

  it('у каждого пункта есть польза, а не только название', () => {
    for (const item of checklistItems(facts())) {
      expect(item.hint.length).toBeGreaterThan(0)
    }
  })
})

describe('отметки', () => {
  it('каждый факт отмечает свой пункт и только его', () => {
    const items = checklistItems(facts({ openedSong: true }))

    expect(items.find((item) => item.key === 'song')?.done).toBe(true)
    expect(items.filter((item) => item.done)).toHaveLength(1)
  })

  it('фотография из Telegram пунктом не считается', () => {
    // hasOwnAvatar приходит от загруженной фотографии, а не от аватара
    // из Telegram: иначе пункт был бы отмечен у всех с самого начала
    expect(completedCount(facts({ hasOwnAvatar: false }))).toBe(0)
  })

  it('считает выполненные', () => {
    expect(completedCount(facts({ openedSong: true, openedChat: true }))).toBe(2)
    expect(completedCount(allDone())).toBe(CHECKLIST_TOTAL)
  })
})

describe('видимость', () => {
  it('новичку список виден', () => {
    expect(isChecklistVisible(facts())).toBe(true)
  })

  it('с частью выполненного всё ещё виден', () => {
    expect(isChecklistVisible(facts({ openedSong: true, openedChat: true }))).toBe(true)
  })

  it('после выполнения всего исчезает сам', () => {
    expect(isChecklistVisible(allDone())).toBe(false)
  })

  it('скрытый человеком не показывается, даже если не всё выполнено', () => {
    expect(isChecklistVisible(facts({ hiddenByUser: true }))).toBe(false)
  })

  it('скрытие не отменяется появлением новых выполненных пунктов', () => {
    expect(isChecklistVisible(facts({ hiddenByUser: true, openedSong: true }))).toBe(false)
  })
})

describe('поздравление', () => {
  it('показывается ровно в тот заход, когда выполнен последний пункт', () => {
    const before = facts({
      openedSong: true,
      openedChat: true,
      watchedStream: true,
      startedCourse: true,
    })

    expect(isJustCompleted(before, allDone())).toBe(true)
  })

  it('не показывается, если и раньше было всё выполнено', () => {
    expect(isJustCompleted(allDone(), allDone())).toBe(false)
  })

  it('не показывается, когда до конца ещё далеко', () => {
    const before = facts({ openedSong: true })
    const after = facts({ openedSong: true, openedChat: true })

    expect(isJustCompleted(before, after)).toBe(false)
  })
})
