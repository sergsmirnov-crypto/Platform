'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import type { SessionUser } from '@/modules/identity'
import { devSignIn } from '@/modules/identity/actions'
import { routes } from '@/shared/routes'
import { Button } from '@/ui'

/**
 * Список участников со входом под каждым.
 *
 * Клиентский компонент, потому что нужны состояние ожидания и показ ошибки.
 * Сам вход выполняется на сервере: сюда возвращается только результат.
 */
export function DevSignInForm({ users }: { users: SessionUser[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSignIn(userId: string) {
    setError(null)

    startTransition(async () => {
      const result = await devSignIn({ userId })

      if (!result.ok) {
        setError(result.message)
        return
      }

      router.push(routes.app.dashboard())
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      {users.map((user) => (
        <div
          key={user.id}
          className="flex items-center justify-between gap-4 rounded border px-4 py-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.displayName}</p>
            <p className="truncate font-mono text-xs opacity-60">{user.id}</p>
          </div>
          <Button onClick={() => handleSignIn(user.id)} disabled={pending}>
            Войти
          </Button>
        </div>
      ))}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
