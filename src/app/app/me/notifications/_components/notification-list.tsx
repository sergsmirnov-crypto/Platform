import Link from 'next/link'

import {
  NOTIFICATION_CATALOG,
  isKnownNotificationType,
  notificationStrings,
} from '@/modules/notifications'
import type { NotificationRow } from '@/modules/notifications'

/**
 * Лента уведомлений.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗАГОЛОВОК ПОКАЗЫВАЕТСЯ ТОТ, ЧТО СОХРАНЁН, А НЕ СОБРАННЫЙ ЗАНОВО
 *
 * Разбор потом переименуют, эфир отменят — а уведомление обязано
 * остаться тем, что человек получил. Пересобирать текст при показе
 * значило бы переписывать прошлое: человек помнит «пришло про
 * Nothing Else Matters», а видит другое название.
 * ─────────────────────────────────────────────────────────────────
 *
 * Непрочитанное помечено полосой слева, а не цветным фоном: строк
 * в ленте бывает полсотни, и раскрашенный список нечитаем.
 */
export function NotificationList({ items }: { items: NotificationRow[] }) {
  return (
    <ul className="border-border divide-border divide-y overflow-hidden rounded-xl border">
      {items.map((item) => (
        <li
          key={String(item.id)}
          className={
            item.readAt === null ? 'border-accent border-l-2' : 'border-l-2 border-l-transparent'
          }
        >
          <Row item={item} />
        </li>
      ))}
    </ul>
  )
}

function Row({ item }: { item: NotificationRow }) {
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <span className="text-content-muted block text-xs">{kindLabel(item.type)}</span>
        <span className="block font-medium">{item.title}</span>
        {item.body ? <span className="text-content-muted block text-sm">{item.body}</span> : null}
      </div>

      <div className="text-content-subtle shrink-0 text-right text-xs">
        <span className="block">{formatDate(item.createdAt)}</span>
        {/* Почему не пришло в мессенджер — видно здесь, а не в логах:
            это первый вопрос, который человек задаёт */}
        {item.sentAt === null ? <span className="block">{notificationStrings.webOnly}</span> : null}
      </div>
    </>
  )

  if (!item.actionUrl) {
    return <div className="flex items-start gap-4 p-4">{content}</div>
  }

  return (
    <Link
      href={item.actionUrl}
      className="hover:bg-surface-hover flex items-start gap-4 p-4 transition-colors"
    >
      {content}
    </Link>
  )
}

/**
 * Название типа.
 *
 * Тип мог исчезнуть из каталога — строка в базе при этом остаётся.
 * Показываем пустоту вместо ключа: `club.old_thing` человеку ничего
 * не говорит и выглядит поломкой.
 */
function kindLabel(type: string): string {
  return isKnownNotificationType(type) ? NOTIFICATION_CATALOG[type].title : ''
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date)
}
