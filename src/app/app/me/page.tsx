import { Bookmark, LineChart, Settings2, StickyNote, User } from 'lucide-react'
import Link from 'next/link'

import { findProfile, yearsPlayingLabel } from '@/modules/identity'
import { getSession } from '@/modules/identity/current-user'
import { libraryStrings } from '@/modules/library'
import { getNoteCount } from '@/modules/library/notes-service'
import { getFavoriteCount } from '@/modules/library/service'
import { routes } from '@/shared/routes'
import { Avatar } from '@/ui'

import { PageIntro } from '../_components/page-intro'

export const metadata = { title: 'Личный кабинет' }

const SECTIONS = [
  { href: routes.app.me.profile(), icon: User, title: 'Профиль', text: 'Имя, город, опыт, вкусы' },
  {
    href: routes.app.me.progress(),
    icon: LineChart,
    title: 'Прогресс',
    text: 'Что пройдено и сколько осталось',
  },
  {
    href: routes.app.me.favorites(),
    icon: Bookmark,
    title: libraryStrings.title,
    text: 'Отложенные разборы и эфиры',
  },
  {
    href: routes.app.me.notes(),
    icon: StickyNote,
    title: libraryStrings.notes.title,
    text: 'Личные пометки к разборам',
  },
  {
    href: routes.app.me.settings(),
    icon: Settings2,
    title: 'Настройки',
    text: 'Подписка, устройства, оформление',
  },
]

/**
 * Личный кабинет — вход в личные разделы.
 *
 * Отдельная страница нужна из-за телефона: в нижней панели «Я» ведёт
 * сюда, а бокового меню с подразделами там нет. На компьютере
 * подразделы видны в меню, и эта страница остаётся кратким обзором.
 */
export default async function MePage() {
  const session = await getSession()
  if (!session) return null

  const [profile, favorites, notes] = await Promise.all([
    findProfile(session.user.id),
    getFavoriteCount(session.user.id),
    getNoteCount(session.user.id),
  ])

  return (
    <>
      <PageIntro title="Личный кабинет" />

      <div className="mb-8 flex items-center gap-4">
        <Avatar src={profile?.avatarUrl} alt={session.user.displayName} size="lg" />

        <div>
          <p className="text-xl font-bold">{session.user.displayName}</p>
          <p className="text-content-muted text-sm">
            {[profile?.city, yearsPlayingLabel(profile?.playingSince ?? null)]
              .filter(Boolean)
              .join(' · ') || 'Профиль пока не заполнен'}
          </p>
        </div>
      </div>

      <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="border-border bg-surface-raised hover:border-accent flex gap-3 rounded-xl border p-4 transition-colors"
          >
            <section.icon size={20} aria-hidden className="text-content-subtle mt-0.5 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{section.title}</span>
              <span className="text-content-muted block text-sm">
                {/* Счётчик вместо описания, когда есть что считать: он
                    отвечает на тот же вопрос точнее и короче */}
                {section.href === routes.app.me.favorites() && favorites > 0
                  ? libraryStrings.count(favorites)
                  : section.href === routes.app.me.notes() && notes > 0
                    ? libraryStrings.notes.total(notes)
                    : section.text}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </>
  )
}
