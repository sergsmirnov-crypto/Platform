'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { streamStrings } from '@/modules/streams'
import { Button, Field, Input } from '@/ui'

import { attachStreamVideoAction } from '../../_actions/stream-editor'

/**
 * Запись эфира.
 *
 * Идентификатор ролика из панели видеохостинга, а не загрузка файла:
 * полтора часа видео через наш сервер не идут и идти не должны
 * (ADR-0016). Куратор выкладывает запись туда, где она и так лежит
 * после монтажа, и переносит сюда одну строку.
 *
 * Поле показывает то, что в нём уже есть: иначе после сохранения оно
 * выглядело бы пустым, и куратор вписал бы ролик второй раз.
 */

type StreamVideoProps = {
  streamId: string
  externalId: string | null
  canEdit: boolean
}

export function StreamVideo({ streamId, externalId, canEdit }: StreamVideoProps) {
  const strings = streamStrings.manage.video
  const router = useRouter()

  const [value, setValue] = useState(externalId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save(next: string | null): void {
    setError(null)

    startTransition(async () => {
      const result = await attachStreamVideoAction({ streamId, externalId: next })

      if (!result.ok) {
        setError(result.message)
        return
      }

      setValue(next ?? '')
      router.refresh()
    })
  }

  return (
    <div>
      <Field
        label={strings.title}
        htmlFor="stream-video"
        hint={strings.hint}
        error={error ?? undefined}
      >
        <Input
          id="stream-video"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="pcFNnQGsD59CMKte2SQQaz"
          disabled={!canEdit || pending}
        />
      </Field>

      {canEdit ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => save(value.trim() || null)} disabled={pending || !value.trim()}>
            {strings.attach}
          </Button>

          {externalId ? (
            <Button variant="ghost" onClick={() => save(null)} disabled={pending}>
              {strings.detach}
            </Button>
          ) : null}

          <span className="text-content-muted text-sm">
            {externalId ? strings.attached : strings.empty}
          </span>
        </div>
      ) : null}
    </div>
  )
}
