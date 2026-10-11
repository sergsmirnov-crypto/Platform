import Link from 'next/link'

import { routes } from '@/shared/routes'

/**
 * Временная навигация по каркасу.
 *
 * Нужна только для того, чтобы по структуре страниц можно было кликать
 * и проверять её до появления настоящего интерфейса.
 *
 * Будет полностью заменена на Этапе 3 (сайдбар, шапка, хлебные крошки,
 * мобильный таб-бар) с учётом прав доступа: раздел «Управление» должен
 * появляться только у тех, у кого есть управляющие права (PRD v0.3 §4.1).
 */

const SECTIONS = [
  {
    title: 'Участник',
    links: [
      { href: routes.app.dashboard(), label: 'Главная' },
      { href: routes.app.learn.index(), label: 'Обучение' },
      { href: routes.app.learn.songs(), label: 'Разборы' },
      { href: routes.app.learn.song('nothing-else-matters'), label: 'Пример разбора' },
      { href: routes.app.learn.course(), label: 'Курс' },
      { href: routes.app.streams.index(), label: 'Эфиры' },
      { href: routes.app.club.index(), label: 'Клуб' },
      { href: routes.app.me.index(), label: 'Личный кабинет' },
      { href: routes.app.onboarding(), label: 'Знакомство' },
      { href: routes.app.subscriptionExpired(), label: 'Подписка закончилась' },
    ],
  },
  {
    title: 'Управление',
    links: [
      { href: routes.app.manage.index(), label: 'Обзор' },
      { href: routes.app.manage.songs(), label: 'Разборы' },
      { href: routes.app.manage.migration(), label: 'Миграция' },
      { href: routes.app.manage.team(), label: 'Команда' },
    ],
  },
]

export function TemporaryNav() {
  return (
    <nav className="border-b px-6 py-3 text-xs">
      <p className="mb-2 font-semibold opacity-60">
        Временная навигация по каркасу · заменяется на Этапе 3
      </p>
      {SECTIONS.map((section) => (
        <div key={section.title} className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="opacity-50">{section.title}:</span>
          {section.links.map((link) => (
            <Link key={link.href} href={link.href} className="underline underline-offset-2">
              {link.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  )
}
