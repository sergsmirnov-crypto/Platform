import Link from 'next/link'

import { identityStrings } from '@/modules/identity'
import { signOutAndRedirect } from '@/modules/identity/actions'
import { getSession } from '@/modules/identity/current-user'
import { routes } from '@/shared/routes'
import { Button } from '@/ui'

/**
 * Кто сейчас вошёл, с кнопкой выхода.
 *
 * Временный элемент шага 2.2: он делает работу сессий видимой, пока нет
 * настоящей шапки. На Этапе 3 заменяется меню профиля в шапке.
 */
export async function SessionIndicator() {
  const session = await getSession()

  if (!session) {
    return (
      <span className="text-xs opacity-60">
        Вход не выполнен ·{' '}
        <Link href={routes.dev.login()} className="underline">
          служебный вход
        </Link>
      </span>
    )
  }

  return (
    <span className="flex items-center gap-3 text-xs">
      <span className="opacity-80">
        Вошёл: <strong className="font-semibold">{session.user.displayName}</strong>
      </span>
      <form action={signOutAndRedirect}>
        <Button type="submit" variant="ghost" size="sm">
          {identityStrings.signOut}
        </Button>
      </form>
    </span>
  )
}
