import Link from 'next/link'
import { notFound } from 'next/navigation'

import { routes } from '@/shared/routes'

/**
 * Карта всех адресов проекта — служебная страница для разработки.
 *
 * Собирается автоматически из реестра `routes`, поэтому не может
 * разойтись с реальностью. В производственной сборке недоступна.
 */

export const metadata = { title: 'Карта адресов' }

/** Примеры значений для динамических адресов, чтобы по ним можно было кликнуть. */
const SAMPLE = 'primer'

type Group = { title: string; links: { href: string; label: string }[] }

const GROUPS: Group[] = [
  {
    title: 'Публичная зона',
    links: [
      { href: routes.home(), label: 'Лендинг и вход' },
      { href: routes.auth.telegram(), label: 'Возврат из Telegram' },
      { href: routes.legal.offer(), label: 'Оферта' },
      { href: routes.legal.privacy(), label: 'Политика данных' },
      { href: routes.legal.contacts(), label: 'Контакты' },
    ],
  },
  {
    title: 'Обучение',
    links: [
      { href: routes.app.learn.index(), label: 'Обучение' },
      { href: routes.app.learn.songs(), label: 'Каталог разборов' },
      { href: routes.app.learn.song(SAMPLE), label: 'Страница разбора' },
      { href: routes.app.learn.course(), label: 'Курс' },
      { href: routes.app.learn.courseModule(SAMPLE), label: 'Модуль курса' },
      { href: routes.app.learn.lesson(SAMPLE, SAMPLE), label: 'Урок' },
    ],
  },
  {
    title: 'Эфиры и клуб',
    links: [
      { href: routes.app.streams.index(), label: 'Архив эфиров' },
      { href: routes.app.streams.upcoming(), label: 'Ближайшие эфиры' },
      { href: routes.app.streams.stream(SAMPLE), label: 'Запись эфира' },
      { href: routes.app.club.index(), label: 'Клуб' },
      { href: routes.app.club.about(), label: 'О клубе' },
      { href: routes.app.club.curators(), label: 'Кураторы' },
      { href: routes.app.club.curator(SAMPLE), label: 'Профиль куратора' },
      { href: routes.app.club.news(), label: 'Новости' },
      { href: routes.app.club.newsPost(SAMPLE), label: 'Новость' },
      { href: routes.app.club.telegram(), label: 'Чаты клуба' },
    ],
  },
  {
    title: 'Личный кабинет',
    links: [
      { href: routes.app.dashboard(), label: 'Главная' },
      { href: routes.app.onboarding(), label: 'Знакомство' },
      { href: routes.app.search(), label: 'Поиск' },
      { href: routes.app.subscriptionExpired(), label: 'Подписка закончилась' },
      { href: routes.app.me.index(), label: 'Личный кабинет' },
      { href: routes.app.me.profile(), label: 'Профиль' },
      { href: routes.app.me.progress(), label: 'Прогресс' },
      { href: routes.app.me.favorites(), label: 'Избранное' },
      { href: routes.app.me.notes(), label: 'Заметки' },
      { href: routes.app.me.settings(), label: 'Настройки' },
    ],
  },
  {
    title: 'Управление',
    links: [
      { href: routes.app.manage.index(), label: 'Обзор' },
      { href: routes.app.manage.songs(), label: 'Разборы' },
      { href: routes.app.manage.song(SAMPLE), label: 'Редактор разбора' },
      { href: routes.app.manage.migration(), label: 'Миграция' },
      { href: routes.app.manage.streams(), label: 'Эфиры' },
      { href: routes.app.manage.course(), label: 'Курс' },
      { href: routes.app.manage.news(), label: 'Новости' },
      { href: routes.app.manage.media(), label: 'Медиатека' },
      { href: routes.app.manage.curators(), label: 'Карточки кураторов' },
      { href: routes.app.manage.team(), label: 'Команда' },
      { href: routes.app.manage.members(), label: 'Участники' },
      { href: routes.app.manage.subscriptions(), label: 'Подписки' },
      { href: routes.app.manage.settings(), label: 'Настройки платформы' },
      { href: routes.app.manage.logs(), label: 'Журнал действий' },
    ],
  },
]

export default function DevRoutesPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold">Карта адресов</h1>
      <p className="mt-2 text-sm opacity-80">
        Служебная страница: доступна только при локальной разработке.
      </p>

      {GROUPS.map((group) => (
        <section key={group.title} className="mt-8">
          <h2 className="text-sm font-semibold tracking-wide uppercase opacity-60">
            {group.title}
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {group.links.map((link) => (
              <li key={link.href} className="flex flex-wrap items-baseline gap-2">
                <Link href={link.href} className="underline underline-offset-2">
                  {link.label}
                </Link>
                <code className="text-xs opacity-50">{link.href}</code>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}
