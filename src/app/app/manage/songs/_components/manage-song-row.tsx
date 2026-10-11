import Link from 'next/link'

import type { PublicationStatus } from '@/shared/db/enums'
import { routes } from '@/shared/routes'
import { Badge } from '@/ui'

/**
 * Строка списка разборов.
 *
 * Порядок сведений — по частоте обращения к ним, а не по важности
 * «вообще»: сначала название, потом состояние, потом сколько вариантов
 * готово, потом кто ведёт. Дата правки последней: она нужна редко,
 * но без неё непонятно, почему разбор стоит первым.
 */

type ManageSongRowProps = {
  song: {
    id: string
    title: string
    artist: string
    status: PublicationStatus
    updatedAt: Date
    arrangementCount: number
    publishedArrangementCount: number
    curatorNames: string[]
  }
}

const STATUS_LABELS: Record<PublicationStatus, { label: string; variant: 'draft' | 'outline' }> = {
  draft: { label: 'Черновик', variant: 'draft' },
  scheduled: { label: 'Запланирован', variant: 'draft' },
  published: { label: 'Опубликован', variant: 'outline' },
  archived: { label: 'В архиве', variant: 'outline' },
}

export function ManageSongRow({ song }: ManageSongRowProps) {
  const status = STATUS_LABELS[song.status]

  return (
    <Link
      href={routes.app.manage.song(song.id)}
      className="hover:bg-surface-hover flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{song.title}</p>
        <p className="text-content-muted truncate text-sm">{song.artist}</p>
      </div>

      <Badge variant={status.variant} size="sm">
        {status.label}
      </Badge>

      {/* «2 из 3» честнее, чем «3 варианта»: куратор видит, что одно
          ещё не опубликовано, не открывая разбор */}
      <span className="text-content-muted w-20 shrink-0 text-sm tabular-nums">
        {song.arrangementCount === 0
          ? 'нет вариантов'
          : `${song.publishedArrangementCount} из ${song.arrangementCount}`}
      </span>

      <span className="text-content-muted hidden w-40 shrink-0 truncate text-sm sm:block">
        {song.curatorNames.join(', ') || '—'}
      </span>

      <time
        dateTime={song.updatedAt.toISOString()}
        className="text-content-subtle hidden w-24 shrink-0 text-right text-sm sm:block"
      >
        {formatDate(song.updatedAt)}
      </time>
    </Link>
  )
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date)
}
