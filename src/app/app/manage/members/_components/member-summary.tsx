import { Ban } from 'lucide-react'

import { blockReasonLabel, directoryStrings } from '@/modules/identity'
import type { MemberDetails } from '@/modules/identity/directory'
import { Avatar, Badge } from '@/ui'

/**
 * Шапка карточки участника: кто это и что с ним сейчас.
 *
 * Полоса блокировки стоит выше всего остального намеренно. Она объясняет
 * состояние, из-за которого карточку чаще всего и открывают, и должна
 * читаться до того, как человек начнёт разбираться в подписке
 * и последнем входе.
 */
export function MemberSummaryCard({ member }: { member: MemberDetails }) {
  return (
    <div className="space-y-6">
      {member.isBlocked ? (
        <div className="border-danger text-danger space-y-1 rounded-lg border px-4 py-3">
          <p className="flex items-center gap-2 font-medium">
            <Ban size={16} aria-hidden />
            {directoryStrings.block.banner}
          </p>

          <p className="text-sm">{blockReasonLabel(member.blockedReason)}</p>

          {member.blockedByName ? (
            <p className="text-sm opacity-80">
              {directoryStrings.block.bannerBy(member.blockedByName)}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <Avatar src={member.avatarUrl} alt={member.displayName} size="lg" />

        <div className="min-w-0">
          <h2 className="font-display truncate text-xl font-bold">{member.displayName}</h2>

          <p className="text-content-muted truncate text-sm">
            {[member.telegramUsername ? `@${member.telegramUsername}` : null, member.city]
              .filter(Boolean)
              .join(' · ') || '—'}
          </p>

          {member.roles.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {member.roles.map((role) => (
                <Badge key={role.code} variant="outline" size="sm">
                  {role.title}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-content-subtle mt-2 text-sm">{directoryStrings.card.noRoles}</p>
          )}
        </div>
      </div>
    </div>
  )
}
