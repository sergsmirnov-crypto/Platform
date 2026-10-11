import { describe, expect, it } from 'vitest'

import { routes } from '@/shared/routes'

import { buildBreadcrumbs, getSectionTitle } from './breadcrumbs'
import { MAIN_NAV, MANAGE_NAV } from './navigation'

/**
 * Тесты хлебных крошек.
 *
 * Отдельного внимания заслуживает последняя группа: она сверяет названия
 * разделов в крошках с названиями в меню. Это не формальность —
 * расхождение здесь означает, что человек видит «Разборы» в меню
 * и «Библиотеку» в пути и считает их разными разделами.
 */

describe('buildBreadcrumbs', () => {
  it('на главной цепочки нет', () => {
    expect(buildBreadcrumbs(routes.app.dashboard(), 'Главная')).toEqual([])
  })

  it('страница раздела включает промежуточный хаб', () => {
    expect(buildBreadcrumbs(routes.app.learn.songs(), 'Разборы')).toEqual([
      { href: '/app', label: 'Главная' },
      { href: '/app/learn', label: 'Обучение' },
      { href: '/app/learn/songs', label: 'Разборы' },
    ])
  })

  it('вложенная страница получает полный путь', () => {
    expect(
      buildBreadcrumbs(routes.app.learn.song('nothing-else-matters'), 'Nothing Else Matters'),
    ).toEqual([
      { href: '/app', label: 'Главная' },
      { href: '/app/learn', label: 'Обучение' },
      { href: '/app/learn/songs', label: 'Разборы' },
      { href: '/app/learn/songs/nothing-else-matters', label: 'Nothing Else Matters' },
    ])
  })

  it('название конечной страницы всегда приходит от неё самой', () => {
    const crumbs = buildBreadcrumbs(routes.app.club.curator('ivan'), 'Иван Петров')
    expect(crumbs.at(-1)).toEqual({ href: '/app/club/curators/ivan', label: 'Иван Петров' })
  })

  it('динамический участок в середине пути распознаётся', () => {
    expect(
      buildBreadcrumbs(routes.app.learn.lesson('basics', 'first-chords'), 'Первые аккорды'),
    ).toEqual([
      { href: '/app', label: 'Главная' },
      { href: '/app/learn', label: 'Обучение' },
      { href: '/app/learn/course', label: 'Курс' },
      { href: '/app/learn/course/basics', label: 'Модуль' },
      { href: '/app/learn/course/basics/first-chords', label: 'Первые аккорды' },
    ])
  })

  it('название сущности в середине пути можно подставить', () => {
    const crumbs = buildBreadcrumbs(
      routes.app.learn.lesson('basics', 'first-chords'),
      'Первые аккорды',
      { [routes.app.learn.courseModule('basics')]: 'Основы' },
    )

    expect(crumbs[3]).toEqual({ href: '/app/learn/course/basics', label: 'Основы' })
  })

  it('несуществующий промежуточный адрес не становится звеном', () => {
    // `/app/subscription` — не страница, вести туда некуда
    expect(buildBreadcrumbs(routes.app.subscriptionExpired(), 'Подписка закончилась')).toEqual([
      { href: '/app', label: 'Главная' },
      { href: '/app/subscription/expired', label: 'Подписка закончилась' },
    ])
  })

  it('раздел управления строится по тем же правилам', () => {
    expect(buildBreadcrumbs(routes.app.manage.team(), 'Команда')).toEqual([
      { href: '/app', label: 'Главная' },
      { href: '/app/manage', label: 'Управление' },
      { href: '/app/manage/team', label: 'Команда' },
    ])
  })

  it('последнее звено ведёт на текущую страницу', () => {
    const crumbs = buildBreadcrumbs(routes.app.me.settings(), 'Настройки')
    expect(crumbs.at(-1)?.href).toBe(routes.app.me.settings())
  })
})

describe('согласованность с меню', () => {
  it('названия разделов первого уровня совпадают с меню', () => {
    for (const item of MAIN_NAV) {
      const title = getSectionTitle(item.href)
      if (title === undefined) continue
      expect(title, `раздел ${item.href}`).toBe(item.label)
    }
  })

  it('названия подразделов совпадают с меню', () => {
    const children = MAIN_NAV.flatMap((item) =>
      // Пункт, ведущий на адрес самого раздела, — это вкладка внутри него,
      // а не отдельный раздел: «Эфиры → Записи» открывают одну страницу.
      // В пути она называется «Эфиры», и это правильно
      (item.children ?? []).filter((child) => child.href !== item.href),
    )

    for (const child of children) {
      const title = getSectionTitle(child.href)
      if (title === undefined) continue
      expect(title, `подраздел ${child.href}`).toBe(child.label)
    }
  })

  it('названия разделов управления совпадают с меню', () => {
    // «Обзор» — тот же случай: пункт ведёт на корень раздела «Управление»
    const items = MANAGE_NAV.filter((item) => item.href !== routes.app.manage.index())

    for (const item of items) {
      const title = getSectionTitle(item.href)
      if (title === undefined) continue
      expect(title, `управление ${item.href}`).toBe(item.label)
    }
  })
})
