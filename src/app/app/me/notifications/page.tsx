import { notificationStrings } from '@/modules/notifications'
import { getFeed, getUnreadCount } from '@/modules/notifications/service'
import { EmptyState } from '@/ui'

import { PageIntro } from '../../_components/page-intro'
import { getViewer } from '../../_lib/viewer'

import { MarkReadButton } from './_components/mark-read-button'
import { NotificationList } from './_components/notification-list'

export const metadata = { title: notificationStrings.title }

/**
 * Лента уведомлений.
 *
 * Существует ровно потому, что Telegram может быть недоступен: строка
 * создаётся всегда, независимо от того, дошло ли сообщение. Человек
 * с заблокированным мессенджером видит здесь всё, что ему приходило.
 */
export default async function NotificationsPage() {
  const viewer = await getViewer()
  if (!viewer.userId) return null

  const [items, unread] = await Promise.all([getFeed(viewer.userId), getUnreadCount(viewer.userId)])

  return (
    <>
      <PageIntro
        title={notificationStrings.title}
        description={notificationStrings.description}
        actions={unread > 0 ? <MarkReadButton /> : undefined}
      />

      {items.length > 0 ? (
        <NotificationList items={items} />
      ) : (
        <EmptyState
          title={notificationStrings.empty}
          description={notificationStrings.emptyDescription}
          className="border-border mt-8 rounded-lg border border-dashed"
        />
      )}
    </>
  )
}
