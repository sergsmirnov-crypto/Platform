'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { clubStrings } from '@/modules/club'
import { routes } from '@/shared/routes'
import { Badge, Button } from '@/ui'

import { removeCuratorCardAction, setCuratorPublicAction } from '../_actions/curator-editor'

/**
 * Показать, скрыть, удалить.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОКАЗ — ОТДЕЛЬНОЕ ДЕЙСТВИЕ, А НЕ ПОЛЕ ФОРМЫ
 *
 * Это единственное свойство карточки, которое меняют, ничего
 * не редактируя: человек заполнил страницу, перечитал её глазами
 * участника и нажал «Показать». Внутри формы такой переключатель
 * терялся бы среди полей, и его находили бы не с первого раза.
 * ─────────────────────────────────────────────────────────────────
 *
 * Удаление доступно только тем, кто правит все карточки, и объясняет
 * последствия до нажатия: чаще всего человеку нужно «скрыть»,
 * а не «удалить».
 */

type CuratorVisibilityProps = {
  userId: string
  isPublic: boolean
  canDelete: boolean
}

export function CuratorVisibility({ userId, isPublic, canDelete }: CuratorVisibilityProps) {
  const strings = clubStrings.manage
  const router = useRouter()

  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function toggle(): void {
    setError(null)

    startTransition(async () => {
      const result = await setCuratorPublicAction({ userId, isPublic: !isPublic })

      if (!result.ok) {
        setError(result.message)
        return
      }

      router.refresh()
    })
  }

  function remove(): void {
    if (!confirm(strings.removeConfirm)) return

    setError(null)

    startTransition(async () => {
      const result = await removeCuratorCardAction({ userId })

      if (!result.ok) {
        setError(result.message)
        return
      }

      router.push(routes.app.manage.curators())
    })
  }

  return (
    <div className="border-border bg-surface-sunken rounded-lg border p-5">
      <div className="flex flex-wrap items-center gap-4">
        <Badge variant={isPublic ? 'outline' : 'draft'}>
          {isPublic ? 'Показана' : clubStrings.curators.hidden}
        </Badge>

        <p className="text-content-muted flex-1 text-sm">
          {isPublic ? 'Карточка есть на странице «Кураторы»' : clubStrings.curators.hiddenHint}
        </p>

        <Button variant={isPublic ? 'secondary' : 'primary'} onClick={toggle} disabled={pending}>
          {isPublic ? strings.hide : strings.show}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-danger mt-3 text-sm">
          {error}
        </p>
      ) : null}

      {canDelete ? (
        <div className="border-border mt-4 border-t pt-4">
          <Button variant="ghost" onClick={remove} disabled={pending}>
            {strings.remove}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
