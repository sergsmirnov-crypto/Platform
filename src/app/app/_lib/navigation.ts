import { BookOpen, Home, type LucideIcon, Radio, User, Users } from 'lucide-react'

import { routes } from '@/shared/routes'

/**
 * Структура навигации платформы.
 *
 * Задана данными, а не разметкой: один и тот же список рисуют сайдбар
 * на компьютере, таб-бар на телефоне и меню внутри разделов. Иначе они
 * рано или поздно разъедутся, и на телефоне окажется пункт, которого нет
 * на компьютере.
 *
 * Пять пунктов, а не семь из исходного брифа (PRD v0.1 §0, пункт 3):
 * больше пяти не помещается в мобильный таб-бар и размывает фокус.
 * «Разборы» и «Курс» объединены в «Обучение» — у них общая природа:
 * учебное содержимое, прогресс, видео, табы. «Кураторы» и «О клубе»
 * убраны внутрь «Клуба»: их открывают один-два раза за всё время,
 * и первому уровню меню там не место.
 */

export type NavChild = {
  href: string
  label: string
  /** Право, без которого пункт не показывается. Пусто — виден всем */
  permission?: string
}

export type NavItem = {
  href: string
  label: string
  /** Короткая подпись для таб-бара: «Личный кабинет» туда не влезет */
  shortLabel: string
  icon: LucideIcon
  children?: NavChild[]
}

export const MAIN_NAV: NavItem[] = [
  {
    href: routes.app.dashboard(),
    label: 'Главная',
    shortLabel: 'Главная',
    icon: Home,
  },
  {
    href: routes.app.learn.index(),
    label: 'Обучение',
    shortLabel: 'Обучение',
    icon: BookOpen,
    children: [
      { href: routes.app.learn.songs(), label: 'Разборы' },
      { href: routes.app.learn.course(), label: 'Курс' },
    ],
  },
  {
    href: routes.app.streams.index(),
    label: 'Эфиры',
    shortLabel: 'Эфиры',
    icon: Radio,
    children: [
      { href: routes.app.streams.index(), label: 'Записи' },
      { href: routes.app.streams.upcoming(), label: 'Ближайшие' },
    ],
  },
  {
    href: routes.app.club.index(),
    label: 'Клуб',
    shortLabel: 'Клуб',
    icon: Users,
    children: [
      { href: routes.app.club.about(), label: 'О клубе' },
      { href: routes.app.club.curators(), label: 'Кураторы' },
      { href: routes.app.club.members(), label: 'Участники' },
      { href: routes.app.club.news(), label: 'Новости' },
      { href: routes.app.club.telegram(), label: 'Чаты в Telegram' },
    ],
  },
  {
    href: routes.app.me.index(),
    label: 'Личный кабинет',
    shortLabel: 'Я',
    icon: User,
  },
]

/**
 * Раздел «Управление».
 *
 * Появляется в меню только при наличии хотя бы одного управляющего права,
 * и внутри показываются лишь доступные пункты — не серые и не заблокированные,
 * а отсутствующие (PRD v0.3 §4.1).
 */
export const MANAGE_NAV: NavChild[] = [
  { href: routes.app.manage.index(), label: 'Обзор' },
  { href: routes.app.manage.songs(), label: 'Разборы', permission: 'songs.view_drafts' },
  { href: routes.app.manage.migration(), label: 'Миграция', permission: 'songs.create' },
  { href: routes.app.manage.streams(), label: 'Эфиры', permission: 'streams.view_drafts' },
  { href: routes.app.manage.course(), label: 'Курс', permission: 'course.view_drafts' },
  { href: routes.app.manage.news(), label: 'Новости', permission: 'news.create' },
  { href: routes.app.manage.media(), label: 'Медиатека', permission: 'media.view_all' },
  { href: routes.app.manage.curators(), label: 'Кураторы', permission: 'curators.edit' },
  { href: routes.app.manage.members(), label: 'Участники', permission: 'users.view' },
  { href: routes.app.manage.team(), label: 'Команда', permission: 'users.roles' },
  { href: routes.app.manage.subscriptions(), label: 'Подписки', permission: 'subs.view' },
  { href: routes.app.manage.settings(), label: 'Настройки', permission: 'settings.edit' },
  { href: routes.app.manage.logs(), label: 'Журнал', permission: 'audit.view' },
]

/**
 * Активен ли пункт меню для текущего адреса.
 *
 * Главная — особый случай: она совпадает по началу со всеми остальными
 * адресами, поэтому для неё требуется точное равенство. Иначе она
 * подсвечивалась бы всегда.
 */
export function isNavItemActive(itemHref: string, pathname: string): boolean {
  if (itemHref === routes.app.dashboard()) {
    return pathname === itemHref
  }

  return pathname === itemHref || pathname.startsWith(`${itemHref}/`)
}
