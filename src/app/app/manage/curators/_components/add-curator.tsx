'use client'

import { Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { clubStrings } from '@/modules/club'
import { routes } from '@/shared/routes'
import { Avatar, Button, Input } from '@/ui'

import { createCuratorCardAction } from '../_actions/curator-editor'

/**
 * Заведение карточки: поиск участника по имени.
 *
 * Куратором становится тот, кто уже в клубе, — приглашать по почте
 * некого. Поэтому здесь не форма нового человека, а поиск среди своих,
 * и в выдаче только те, у кого карточки ещё нет.
 *
 * Карточка появляется скрытой и пустой: заполнит её сам человек.
 * Заполнять чужую страницу за коллегу — работа, которую никто
 * не сделает хорошо.
 */

type Candidate = { id: string; displayName: string; avatarUrl: string | null }

export function AddCurator({ search }: { search: (query: string) => Promise<Candidate[]> }) {
  const strings = clubStrings.manage
  const router = useRouter()

  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Candidate[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function lookup(value: string): void {
    setQuery(value)
    setError(null)

    startTransition(async () => {
      setFound(await search(value))
    })
  }

  function add(userId: string): void {
    setError(null)

    startTransition(async () => {
      const result = await createCuratorCardAction({ userId })

      if (!result.ok) {
        setError(result.message)
        return
      }

      // Сразу в редактор карточки: следующее, что нужно сделать, —
      // заполнить её, и возвращать человека в список незачем
      router.push(routes.app.manage.curator(userId))
    })
  }

  return (
    <div className="border-border bg-surface-raised rounded-xl border p-5">
      <p className="text-content-muted mb-4 text-sm">{strings.addHint}</p>

      <div className="relative max-w-md">
        <Search
          size={18}
          aria-hidden
          className="text-content-subtle pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
        />
        <Input
          value={query}
          onChange={(event) => lookup(event.target.value)}
          placeholder={strings.search}
          aria-label={strings.search}
          className="pl-10"
        />
      </div>

      {found.length > 0 ? (
        <ul className="border-border mt-3 max-w-md divide-y overflow-hidden rounded-lg border">
          {found.map((candidate) => (
            <li key={candidate.id}>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 rounded-none"
                disabled={pending}
                onClick={() => add(candidate.id)}
              >
                <Avatar src={candidate.avatarUrl} alt={candidate.displayName} size="sm" />
                {candidate.displayName}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p role="alert" className="text-danger mt-3 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  )
}
