'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import type { PublicationBlocker } from '@/modules/songs'
import type { PublicationStatus } from '@/shared/db/enums'
import { Badge, Button } from '@/ui'

import {
  archiveSongAction,
  publishSongAction,
  unpublishSongAction,
} from '../../_actions/song-editor'

/**
 * Состояние публикации и кнопки его смены.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПРЕПЯТСТВИЯ ПОКАЗЫВАЮТСЯ ДО НАЖАТИЯ, А НЕ ПОСЛЕ
 *
 * Куратор нажимает «Опубликовать» в конце работы, потратив полчаса.
 * Ответ «нельзя» в этот момент — худшее, что может сделать интерфейс:
 * человек не знает, что чинить, и в следующий раз откладывает публикацию
 * вовсе, а «кураторы не публикуют» — риск №2 всего проекта.
 *
 * Поэтому список того, чего не хватает, виден заранее и обновляется
 * по мере заполнения. Кнопка при этом не блокируется: сервер всё равно
 * проверит сам, а заблокированная кнопка без объяснения — та же ошибка,
 * только раньше.
 * ─────────────────────────────────────────────────────────────────
 */

type PublishBarProps = {
  songId: string
  slug: string
  /**
   * Название и исполнитель нужны оповещению клуба.
   *
   * Передаются с формы, а не читаются сервером заново: куратор мог
   * только что их поправить, и уведомление обязано уйти с тем текстом,
   * который он видит на экране
   */
  title: string
  artist: string
  status: PublicationStatus
  blockers: PublicationBlocker[]
  canPublish: boolean
  canArchive: boolean
}

const STATUS_LABELS: Record<PublicationStatus, string> = {
  draft: 'Черновик',
  scheduled: 'Запланирован',
  published: 'Опубликован',
  archived: 'В архиве',
}

export function PublishBar({
  songId,
  slug,
  title,
  artist,
  status,
  blockers,
  canPublish,
  canArchive,
}: PublishBarProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (!result.ok) setError(result.message ?? 'Не удалось выполнить действие')
      else router.refresh()
    })
  }

  const isPublished = status === 'published'

  return (
    <div className="border-border bg-surface-sunken rounded-lg border p-5">
      <div className="flex flex-wrap items-center gap-4">
        <Badge variant={isPublished ? 'outline' : 'draft'}>{STATUS_LABELS[status]}</Badge>

        <p className="text-content-muted flex-1 text-sm">
          {isPublished
            ? 'Разбор виден участникам клуба'
            : 'Разбор виден только кураторам. Участники его не найдут'}
        </p>

        {canPublish ? (
          <Button
            onClick={() =>
              run(() =>
                isPublished
                  ? unpublishSongAction({ songId, slug })
                  : publishSongAction({ songId, slug, title, artist }),
              )
            }
            variant={isPublished ? 'secondary' : 'primary'}
            disabled={pending}
          >
            {isPublished ? 'Снять с публикации' : 'Опубликовать'}
          </Button>
        ) : null}

        {canArchive && status !== 'archived' ? (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => {
              if (confirm('Убрать разбор в архив? Участники перестанут его видеть.')) {
                run(() => archiveSongAction({ songId, slug }))
              }
            }}
          >
            В архив
          </Button>
        ) : null}
      </div>

      {!isPublished && blockers.length > 0 ? (
        <div className="border-border mt-4 border-t pt-4">
          <p className="text-content-subtle mb-2 text-xs tracking-wide uppercase">
            Чтобы опубликовать, не хватает
          </p>
          <ul className="text-content-muted space-y-1 text-sm">
            {blockers.map((blocker) => (
              <li key={blocker.field}>· {blocker.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="text-danger mt-4 text-sm">{error}</p> : null}
    </div>
  )
}
