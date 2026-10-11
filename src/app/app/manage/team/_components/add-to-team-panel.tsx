'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

import { Avatar, Button, Dialog, Input } from '@/ui'

import { searchMembers } from '../_actions/settings'
import { assignRoleAction } from '../_actions/team'

/**
 * Добавление человека в команду.
 *
 * Поиск по уже существующим участникам, а не приглашение по почте:
 * человек уже в клубе, у него уже есть аккаунт и вход через Telegram.
 * Приглашать его некуда.
 *
 * Роль при добавлении всегда «Куратор» — самая узкая. Расширить её
 * можно сразу же в панели «Настроить»; обратный порядок — сначала
 * широкие права, потом сужение — оставляет окно, в котором человек
 * может успеть сделать лишнее.
 */

type Found = {
  userId: string
  displayName: string
  avatarUrl: string | null
  telegramUsername: string | null
  hasRole: boolean
}

const SEARCH_DELAY_MS = 350

export function AddToTeamPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Found[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const timer = setTimeout(() => {
      void searchMembers({ query }).then((result) => {
        if (result.ok) setFound(result.data)
        else setError(result.message)
      })
    }, SEARCH_DELAY_MS)

    return () => clearTimeout(timer)
  }, [query])

  function add(userId: string) {
    setError(null)

    startTransition(async () => {
      const result = await assignRoleAction({ userId, roleCode: 'curator' })

      if (!result.ok) {
        setError(result.message)
        return
      }

      router.refresh()
      onClose()
    })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Добавить в команду"
      description="Человек получит роль куратора. Расширить права можно сразу после добавления."
    >
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Имя или @ник в Telegram"
        aria-label="Поиск участника"
        autoFocus
      />

      <ul className="divide-border mt-4 max-h-80 divide-y overflow-y-auto">
        {found.map((person) => (
          <li key={person.userId} className="flex items-center gap-3 py-2">
            <Avatar src={person.avatarUrl} alt={person.displayName} size="sm" />

            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{person.displayName}</span>
              {person.telegramUsername ? (
                <span className="text-content-muted block truncate text-xs">
                  @{person.telegramUsername}
                </span>
              ) : null}
            </span>

            {person.hasRole ? (
              <span className="text-content-subtle text-xs">уже в команде</span>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => add(person.userId)}
              >
                Добавить
              </Button>
            )}
          </li>
        ))}

        {found.length === 0 ? (
          <li className="text-content-subtle py-4 text-sm">Никого не найдено</li>
        ) : null}
      </ul>

      {error ? <p className="text-danger mt-3 text-sm">{error}</p> : null}
    </Dialog>
  )
}
