'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { streamStrings } from '@/modules/streams'
import type { StreamState } from '@/modules/streams'
import type { StreamBlocker } from '@/modules/streams/editor-service'
import type { PublicationStatus } from '@/shared/db/enums'
import { routes } from '@/shared/routes'
import { Badge, Button, PillLink } from '@/ui'

import {
  deleteStreamAction,
  setStreamPublishedAction,
  setStreamStateAction,
} from '../../_actions/stream-editor'

/**
 * Этап жизни, публикация и удаление.
 *
 * ─────────────────────────────────────────────────────────────────
 * ДВА ПЕРЕКЛЮЧАТЕЛЯ РЯДОМ, И ЭТО НЕ ПУТАНИЦА
 *
 * «Этап» отвечает на вопрос, что с эфиром происходит: скоро, идёт,
 * запись, отменён. «Публикация» — видят ли его участники. Это разные
 * вопросы, и куратор пользуется ими в разное время: анонс он публикует
 * за неделю, а этап переключает в день эфира.
 *
 * Стоят рядом именно потому, что их легко перепутать по отдельности:
 * увидев оба, человек читает подписи и выбирает нужное. Разнеси их
 * по разным углам страницы — и «почему участники не видят эфир, я же
 * нажал „идёт“» станет постоянным вопросом.
 * ─────────────────────────────────────────────────────────────────
 *
 * Препятствия к публикации показаны заранее, до нажатия: отказ
 * в последний момент — прямой путь к тому, что кураторы перестают
 * публиковать, а это риск №2 всего проекта.
 */

const STATES: { value: StreamState; label: string }[] = [
  { value: 'scheduled', label: streamStrings.manage.state.scheduled },
  { value: 'live', label: streamStrings.manage.state.live },
  { value: 'recorded', label: streamStrings.manage.state.recorded },
  { value: 'cancelled', label: streamStrings.manage.state.cancelled },
]

type StreamStatusBarProps = {
  streamId: string
  state: StreamState
  status: PublicationStatus
  blockers: StreamBlocker[]
  canEdit: boolean
  canPublish: boolean
  canDelete: boolean
}

export function StreamStatusBar({
  streamId,
  state,
  status,
  blockers,
  canEdit,
  canPublish,
  canDelete,
}: StreamStatusBarProps) {
  const strings = streamStrings.manage
  const router = useRouter()

  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isPublished = status === 'published'

  function run(action: () => Promise<{ ok: boolean; message?: string }>, after?: () => void): void {
    setError(null)
    startTransition(async () => {
      const result = await action()

      if (!result.ok) {
        setError(result.message ?? 'Не удалось выполнить действие')
        return
      }

      if (after) after()
      else router.refresh()
    })
  }

  return (
    <div className="border-border bg-surface-sunken rounded-lg border p-5">
      <div className="flex flex-wrap items-center gap-4">
        <Badge variant={isPublished ? 'outline' : 'draft'}>
          {isPublished ? 'Опубликован' : 'Черновик'}
        </Badge>

        <p className="text-content-muted flex-1 text-sm">
          {isPublished ? strings.publish.published : strings.publish.draft}
        </p>

        {canPublish ? (
          <Button
            variant={isPublished ? 'secondary' : 'primary'}
            disabled={pending}
            onClick={() =>
              run(() => setStreamPublishedAction({ streamId, published: !isPublished }))
            }
          >
            {isPublished ? strings.publish.unpublish : strings.publish.publish}
          </Button>
        ) : null}
      </div>

      {!isPublished && blockers.length > 0 ? (
        <div className="border-border mt-4 border-t pt-4">
          <p className="text-content-subtle mb-2 text-xs tracking-wide uppercase">
            {strings.publish.blockers}
          </p>
          <ul className="text-content-muted space-y-1 text-sm">
            {blockers.map((blocker) => (
              <li key={blocker.field}>· {blocker.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="border-border mt-4 border-t pt-4">
        <p className="text-content-subtle mb-2 text-xs tracking-wide uppercase">
          {strings.state.title}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {STATES.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={!canEdit || pending || option.value === state}
              aria-pressed={option.value === state}
              onClick={() => run(() => setStreamStateAction({ streamId, state: option.value }))}
              className={
                option.value === state
                  ? 'border-accent bg-accent text-accent-content min-h-11 rounded-full border px-4 text-sm font-medium'
                  : 'border-border text-content-muted hover:border-border-strong min-h-11 rounded-full border px-4 text-sm transition-colors disabled:opacity-50'
              }
            >
              {option.label}
            </button>
          ))}
        </div>

        <p className="text-content-subtle mt-2 text-xs">{strings.state.hint}</p>
      </div>

      {error ? (
        <p role="alert" className="text-danger mt-4 text-sm">
          {error}
        </p>
      ) : null}

      {canDelete ? (
        <div className="border-border mt-4 flex flex-wrap items-center gap-3 border-t pt-4">
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => {
              // Подтверждение с объяснением, а не «вы уверены?»: куратор,
              // у которого эфир не состоялся, почти всегда хочет отмену,
              // а не удаление — и должен узнать об этом до нажатия
              if (confirm(strings.publish.deleteConfirm)) {
                run(
                  () => deleteStreamAction({ streamId }),
                  () => router.push(routes.app.manage.streams()),
                )
              }
            }}
          >
            {strings.publish.delete}
          </Button>

          <PillLink href={routes.app.manage.streams()} size="sm">
            К списку эфиров
          </PillLink>
        </div>
      ) : null}
    </div>
  )
}
