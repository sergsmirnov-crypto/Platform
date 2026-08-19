import { describe, expect, it } from 'vitest'

import { buildOverviewCounters, buildOverviewTasks } from './manage-overview-tasks'

import type { OverviewInput } from './manage-overview-tasks'

/**
 * Проверяется главное свойство экрана: тихая поломка обязана попасть
 * в список забот, а отсутствие прав не должно выглядеть как «всё
 * в порядке».
 */

const nothing: OverviewInput = {
  songs: null,
  streams: null,
  course: null,
  failedAssets: null,
  subscriptions: null,
}

const calm: OverviewInput = {
  songs: { publishedRecently: 2, draftCount: 1, staleDrafts: [] },
  streams: { publishedRecently: 1, missingRecordings: [] },
  course: { draftModules: 0, draftLessons: 3, emptyModules: [] },
  failedAssets: 0,
  subscriptions: { summary: { attention: 0 } },
}

describe('buildOverviewTasks', () => {
  it('без прав ничего не спрашивали — и забот нет', () => {
    expect(buildOverviewTasks(nothing)).toEqual([])
  })

  it('когда всё в порядке, забот нет', () => {
    expect(buildOverviewTasks(calm)).toEqual([])
  })

  it('прошедший эфир без записи попадает в заботы', () => {
    const tasks = buildOverviewTasks({
      ...calm,
      streams: { publishedRecently: 1, missingRecordings: [{ title: 'Джем 14 марта' }] },
    })

    expect(tasks).toHaveLength(1)
    expect(tasks[0]?.id).toBe('streams.missing-recordings')
    expect(tasks[0]?.hint).toContain('Джем 14 марта')
  })

  it('опубликованный модуль курса без уроков попадает в заботы', () => {
    const tasks = buildOverviewTasks({
      ...calm,
      course: { draftModules: 0, draftLessons: 0, emptyModules: [{ title: 'Барре' }] },
    })

    expect(tasks[0]?.id).toBe('course.empty-modules')
  })

  it('тихие поломки идут раньше забытой работы', () => {
    const tasks = buildOverviewTasks({
      ...calm,
      failedAssets: 2,
      songs: {
        publishedRecently: 0,
        draftCount: 4,
        staleDrafts: [{ title: 'Nothing Else Matters', artist: 'Metallica' }],
      },
    })

    expect(tasks.map((task) => task.id)).toEqual(['media.failed', 'songs.stale-drafts'])
  })

  it('в подсказке показываются два названия, остальные — числом', () => {
    const tasks = buildOverviewTasks({
      ...calm,
      streams: {
        publishedRecently: 0,
        missingRecordings: [{ title: 'Первый' }, { title: 'Второй' }, { title: 'Третий' }],
      },
    })

    expect(tasks[0]?.hint).toBe('Первый, Второй и ещё 1')
  })

  it('числительные склоняются', () => {
    const one = buildOverviewTasks({ ...calm, failedAssets: 1 })[0]?.title
    const five = buildOverviewTasks({ ...calm, failedAssets: 5 })[0]?.title

    expect(one).toBe('1 файл не загрузился')
    expect(five).toBe('5 файлов не загрузились')
  })
})

describe('buildOverviewCounters', () => {
  it('без прав счётчик не появляется вовсе', () => {
    expect(buildOverviewCounters(nothing)).toEqual([])
  })

  it('ноль показывается как ноль, а не прячется', () => {
    const counters = buildOverviewCounters({
      songs: { publishedRecently: 0, draftCount: 0, staleDrafts: [] },
      streams: null,
      course: null,
    })

    expect(counters).toHaveLength(2)
    expect(counters.every((counter) => counter.value === 0)).toBe(true)
  })

  it('черновики курса считаются вместе с модулями', () => {
    const counters = buildOverviewCounters({
      songs: null,
      streams: null,
      course: { draftModules: 2, draftLessons: 3, emptyModules: [] },
    })

    expect(counters[0]?.value).toBe(5)
  })
})
