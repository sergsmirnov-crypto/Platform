import { Bell } from 'lucide-react'
import Link from 'next/link'

import { formatUnreadBadge, notificationStrings } from '@/modules/notifications'
import { getUnreadCount } from '@/modules/notifications/service'
import { routes } from '@/shared/routes'

/**
 * Колокольчик со счётчиком непрочитанного.
 *
 * ─────────────────────────────────────────────────────────────────
 * СЕРВЕРНЫЙ КОМПОНЕНТ, БЕЗ ОБНОВЛЕНИЯ В ФОНЕ
 *
 * Счётчик считается при отрисовке страницы и не опрашивает сервер.
 * Соблазн сделать «живой» значок был; отказался осознанно.
 *
 * Уведомления здесь появляются не чаще нескольких раз в день, а опрос
 * раз в минуту — это полторы тысячи лишних запросов в сутки на двести
 * пятьдесят человек ради того, чтобы цифра сменилась на четыре минуты
 * раньше. Человек и так узнаёт о новом из Telegram.
 *
 * Счётчик обновится при следующем переходе по платформе — этого
 * достаточно.
 * ─────────────────────────────────────────────────────────────────
 */
export async function NotificationBell({ userId }: { userId: string }) {
  const badge = formatUnreadBadge(await getUnreadCount(userId))

  return (
    <Link
      href={routes.app.me.notifications()}
      aria-label={badge ? notificationStrings.unreadLabel(badge) : notificationStrings.title}
      className="text-content-muted hover:text-content relative flex h-11 w-11 items-center justify-center"
    >
      <Bell size={20} aria-hidden />

      {badge ? (
        <span className="bg-accent text-accent-content absolute top-1.5 right-1 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 font-medium">
          {badge}
        </span>
      ) : null}
    </Link>
  )
}
