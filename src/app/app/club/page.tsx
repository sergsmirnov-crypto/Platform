import { BookOpen, MessageCircle, Newspaper, Users } from 'lucide-react'
import Link from 'next/link'

import { clubStrings } from '@/modules/club'
import { routes } from '@/shared/routes'

import { PageIntro } from '../_components/page-intro'

export const metadata = { title: 'Клуб' }

/**
 * Хаб раздела «Клуб».
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗАЧЕМ ВООБЩЕ НУЖНА ЭТА СТРАНИЦА
 *
 * На мобильном нижнее меню умещает пять пунктов, и вложенные разделы
 * в нём не раскрываются — нажатие на «Клуб» должно куда-то приводить.
 * Эта страница и есть ответ: четыре плитки вместо выпадающего списка,
 * которого на телефоне нет.
 *
 * На большом экране те же разделы доступны из бокового меню, поэтому
 * страница там почти не нужна — и именно поэтому она такая короткая.
 * Дублировать на ней содержимое разделов было бы работой ради работы.
 * ─────────────────────────────────────────────────────────────────
 */
const SECTIONS = [
  {
    href: routes.app.club.about(),
    icon: BookOpen,
    title: 'О клубе',
    description: 'Как устроено обучение, расписание эфиров и частые вопросы',
  },
  {
    href: routes.app.club.curators(),
    icon: Users,
    title: 'Кураторы',
    description: 'Кто ведёт разборы, курс и эфиры',
  },
  {
    href: routes.app.club.members(),
    icon: Users,
    title: clubStrings.members.title,
    description: clubStrings.members.description,
  },
  {
    href: routes.app.club.telegram(),
    icon: MessageCircle,
    title: 'Чаты клуба',
    description: 'Общий чат, вопросы кураторам, идеи',
  },
  {
    href: routes.app.club.news(),
    icon: Newspaper,
    title: 'Новости',
    description: 'Что происходит в клубе',
  },
]

export default function ClubHubPage() {
  return (
    <>
      <PageIntro title="Клуб" description="Люди, правила и жизнь сообщества" />

      <ul className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <li key={section.href}>
            <Link
              href={section.href}
              className="group border-border bg-surface-raised hover:border-border-strong flex min-h-24 items-start gap-4 rounded-xl border p-5 transition-colors"
            >
              <section.icon size={22} aria-hidden className="text-content-subtle mt-0.5 shrink-0" />

              <span className="min-w-0">
                <span className="group-hover:text-accent-hover font-display block text-lg font-bold transition-colors">
                  {section.title}
                </span>
                <span className="text-content-muted block text-sm">{section.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
