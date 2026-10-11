'use client'

import { UserPlus } from 'lucide-react'
import { useState, useTransition } from 'react'

// Из листового файла, а не из публичного входа модуля: тот тянет
// за собой запросы к базе с пометкой `server-only`, и сборка браузерной
// части падает
import type { TeamMember, TeamMemberSettings } from '@/modules/access/team'
import { overridesLabel } from '@/modules/access/team-rules'
import { Avatar, Badge, Button, EmptyState } from '@/ui'

import { loadMemberSettings } from '../_actions/settings'

import { AddToTeamPanel } from './add-to-team-panel'
import { PermissionsPanel } from './permissions-panel'

/**
 * Список команды.
 *
 * Настройки конкретного человека подгружаются в момент открытия панели,
 * а не заранее для всех: сорок прав на десятерых — это четыреста строк,
 * которые почти никогда не понадобятся.
 */
export function TeamList({ members }: { members: TeamMember[] }) {
  const [selected, setSelected] = useState<TeamMember | null>(null)
  const [settings, setSettings] = useState<TeamMemberSettings | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function open(member: TeamMember) {
    setError(null)
    setSelected(member)
    setSettings(null)

    startTransition(async () => {
      const result = await loadMemberSettings({ userId: member.userId })

      if (!result.ok) {
        setError(result.message)
        setSelected(null)
        return
      }

      setSettings(result.data)
    })
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-content-muted text-sm">
          {members.length > 0 ? `В команде: ${members.length}` : null}
        </p>

        <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
          <UserPlus size={16} aria-hidden />
          Добавить
        </Button>
      </div>

      {members.length === 0 ? (
        <EmptyState
          className="border-border rounded-lg border border-dashed"
          title="В команде пока только вы"
          description="Добавьте куратора — он получит доступ к редактированию разборов и эфиров"
        />
      ) : (
        <ul className="border-border divide-border divide-y overflow-hidden rounded-lg border">
          {members.map((member) => {
            const label = overridesLabel(member.overrides)

            return (
              <li key={member.userId} className="flex min-h-16 items-center gap-4 px-4 py-3">
                <Avatar src={member.avatarUrl} alt={member.displayName} size="sm" />

                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{member.displayName}</span>

                  <span className="text-content-muted block text-sm">
                    {member.roles[0]?.title ?? 'Без роли'}
                    {/* Пометка «+2 −1»: видно с одного взгляда, у кого
                        настройка нестандартная, без открытия каждого */}
                    {label ? <span className="text-accent ml-2">{label}</span> : null}
                  </span>
                </span>

                {member.isBlocked ? (
                  <Badge variant="draft" size="sm">
                    заблокирован
                  </Badge>
                ) : null}

                <Button variant="ghost" size="sm" disabled={pending} onClick={() => open(member)}>
                  Настроить
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      {error ? <p className="text-danger mt-4 text-sm">{error}</p> : null}

      {selected && settings ? (
        <PermissionsPanel
          member={selected}
          settings={settings}
          onClose={() => {
            setSelected(null)
            setSettings(null)
          }}
        />
      ) : null}

      {adding ? <AddToTeamPanel onClose={() => setAdding(false)} /> : null}
    </>
  )
}
