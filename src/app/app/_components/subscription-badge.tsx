import { getSession } from '@/modules/identity/current-user'
import { getAccessStatus, subscriptionStrings } from '@/modules/subscription'

/**
 * Состояние подписки текущего участника.
 *
 * Временный элемент шага 2.4: делает работу подписок видимой до появления
 * настоящих экранов. На Этапе 4 переезжает в настройки личного кабинета,
 * а баннер о скором окончании — в шапку платформы.
 */

const TONE: Record<string, string> = {
  active: 'text-content',
  grace: 'text-accent-content bg-accent',
  expired: 'text-danger-content bg-danger',
  none: 'opacity-60',
}

export async function SubscriptionBadge() {
  const session = await getSession()
  if (!session) return null

  const access = await getAccessStatus(session.user.id)

  return (
    <span className="flex items-center gap-2 text-xs">
      <span className={`rounded-full px-3 py-1 ${TONE[access.status] ?? ''}`}>
        {subscriptionStrings.status[access.status]}
        {access.daysLeft !== null ? ` · ${access.daysLeft} дн.` : ''}
      </span>
      {access.isStale ? <span className="opacity-60">статус Telegram неизвестен</span> : null}
    </span>
  )
}
