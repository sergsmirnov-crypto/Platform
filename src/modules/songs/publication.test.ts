import { describe, expect, it } from 'vitest'

import { canPublish, findPublicationBlockers, nextStatus } from './publication'

const READY = {
  title: 'Nothing Else Matters',
  artist: 'Metallica',
  arrangements: [{ status: 'published' as const, sectionCount: 6 }],
}

describe('findPublicationBlockers', () => {
  it('готовый разбор публикуется без препятствий', () => {
    expect(findPublicationBlockers(READY)).toEqual([])
    expect(canPublish(READY)).toBe(true)
  })

  it('называет незаполненное название', () => {
    const blockers = findPublicationBlockers({ ...READY, title: '  ' })

    expect(blockers[0]).toEqual({ field: 'title', message: 'Не заполнено название песни' })
  })

  it('требует хотя бы один опубликованный вариант', () => {
    const blockers = findPublicationBlockers({
      ...READY,
      arrangements: [{ status: 'draft', sectionCount: 6 }],
    })

    expect(blockers.map((item) => item.field)).toContain('arrangements')
  })

  it('не выпускает разбор без размеченных частей', () => {
    const blockers = findPublicationBlockers({
      ...READY,
      arrangements: [{ status: 'published', sectionCount: 0 }],
    })

    expect(blockers.map((item) => item.field)).toContain('sections')
  })

  it('не требует видео: размеченная структура уже полезна', () => {
    // Иначе куратор не сможет опубликовать разбор, пока не смонтирует
    // все ролики, — а это неделя, в течение которой участники не видят
    // даже того, что песня в работе
    expect(canPublish(READY)).toBe(true)
  })

  it('называет сразу все препятствия, а не первое', () => {
    const blockers = findPublicationBlockers({ title: '', artist: '', arrangements: [] })

    expect(blockers.length).toBeGreaterThanOrEqual(3)
  })
})

describe('nextStatus', () => {
  it('публикация делает разбор опубликованным', () => {
    expect(nextStatus('draft', 'publish')).toBe('published')
  })

  it('снятие с публикации возвращает в черновик, а не в архив', () => {
    // Куратор, снявший разбор ради опечатки, не должен искать его в архиве
    expect(nextStatus('published', 'unpublish')).toBe('draft')
  })

  it('архивирование убирает разбор из работы', () => {
    expect(nextStatus('published', 'archive')).toBe('archived')
  })

  it('восстановление из архива даёт черновик', () => {
    expect(nextStatus('archived', 'restore')).toBe('draft')
  })

  it('восстановление неархивного разбора ничего не меняет', () => {
    expect(nextStatus('published', 'restore')).toBe('published')
  })
})
