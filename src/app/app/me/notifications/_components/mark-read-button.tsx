'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { notificationStrings } from '@/modules/notifications'
import { Button } from '@/ui'

import { markNotificationsReadAction } from '../../../_actions/notifications'

/** Отметить всё прочитанным. Единственный код в браузере на этой странице */
export function MarkReadButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markNotificationsReadAction({})
          // Обновление нужно: исчезают полосы у строк и счётчик в шапке
          router.refresh()
        })
      }
    >
      {notificationStrings.markAllRead}
    </Button>
  )
}
