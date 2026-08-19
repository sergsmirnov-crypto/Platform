import { Ban } from 'lucide-react'

import { directoryStrings } from '@/modules/identity'
import type { MemberSummary } from '@/modules/identity/directory'
import { subscriptionStrings } from '@/modules/subscription'
import { routes } from '@/shared/routes'
import { Avatar, Badge, PillLink } from '@/ui'

/**
 * Одна строка списка участников.
 *
 * ─────────────────────────────────────────────────────────────────
 * СТРОКА, А НЕ КАРТОЧКА
 *
 * Карточки хороши, когда выбирают: обложка, название, настроение.
 * Здесь выбирать нечего — здесь сравнивают. «Кто из этих троих
 * без подписки», «кто не заходил месяц» читается только глазами
 * сверху вниз, по колонкам.
 * ─────────────────────────────────────────────────────────────────
 *
 * На узком экране колонки складываются в две строки: имя с ником
 * и под ним состояние. Прятать состояние на телефоне нельзя — ради
 * него список и открывают.
 */

const ACCESS_BADGE = {
  active: { variant: 'outline', label: subscriptionStrings.status.active },
  grace: { variant: 'accent', label: subscriptionStrings.status.grace },
  expired: { variant: 'draft', label: subscriptionStrings.status.expired },
  none: { variant: 'draft', label: subscriptionStrings.status.none },
} as const

export function MemberRow({ member }: { member: MemberSummary }) {
  const access = ACCESS_BADGE[member.accessStatus]

  return (
    <PillLink
      href={routes.app.manage.member(member.userId)}
      className="hover:bg-surface-hover flex min-h-16 w-full items-center gap-4 rounded-none border-0 px-4 py-3"
    >
      <Avatar src={member.avatarUrl} alt={member.displayName} size="sm" />

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium">{member.displayName}</span>

          {member.isBlocked ? (
            <Ban size={14} aria-label={directoryStrings.block.banner} className="text-danger" />
          ) : null}
        </span>

        <span className="text-content-muted block truncate text-sm">
          {[member.telegramUsername ? `@${member.telegramUsername}` : null, member.city]
            .filter(Boolean)
            .join(' · ') || '—'}
        </span>
      </span>

      <span className="hidden text-sm sm:block">
        <MemberRoles roles={member.roles} />
      </span>

      <Badge variant={access.variant} size="sm">
        {access.label}
      </Badge>
    </PillLink>
  )
}

/**
 * Роли строкой.
 *
 * Показывается только старшая: у человека их обычно одна, а две
 * в узкой колонке превращаются в кашу. Полный список — в карточке.
 */
function MemberRoles({ roles }: { roles: MemberSummary['roles'] }) {
  const top = roles[0]

  if (!top) return <span className="text-content-subtle">—</span>

  return (
    <span className="text-content-muted whitespace-nowrap">
      {top.title}
      {roles.length > 1 ? ` +${roles.length - 1}` : ''}
    </span>
  )
}
