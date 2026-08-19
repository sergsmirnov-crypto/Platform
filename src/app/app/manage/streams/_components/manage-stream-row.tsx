import Link from 'next/link'

import { formatStreamDateTime, streamStrings } from '@/modules/streams'
import type { StreamState } from '@/modules/streams'
import type { PublicationStatus } from '@/shared/db/enums'
import { routes } from '@/shared/routes'
import { Badge } from '@/ui'

/**
 * Строка списка эфиров.
 *
 * Порядок сведений — по частоте обращения: когда эфир, как называется,
 * что с ним происходит, виден ли участникам, есть ли запись
 * и оглавление. Последние два — самое частое «что тут недоделано»,
 * поэтому они видны, не открывая эфир.
 */

type ManageStreamRowProps = {
  stream: {
    id: string
    title: string
    startsAt: Date
    state: StreamState
    status: PublicationStatus
    curatorName: string | null
    hasVideo: boolean
    chapterCount: number
  }
}

const STATE_LABELS: Record<StreamState, string> = {
  scheduled: streamStrings.manage.state.scheduled,
  live: streamStrings.manage.state.live,
  recorded: streamStrings.manage.state.recorded,
  cancelled: streamStrings.manage.state.cancelled,
}

export function ManageStreamRow({ stream }: ManageStreamRowProps) {
  const isPublished = stream.status === 'published'

  return (
    <Link
      href={routes.app.manage.stream(stream.id)}
      className="hover:bg-surface-hover flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{stream.title}</p>
        <p className="text-content-muted truncate text-sm">
          {formatStreamDateTime(stream.startsAt)} {streamStrings.page.timezone}
          {stream.curatorName ? ` · ${stream.curatorName}` : ''}
        </p>
      </div>

      <Badge variant={stream.state === 'live' ? 'danger' : 'outline'} size="sm">
        {STATE_LABELS[stream.state]}
      </Badge>

      <Badge variant={isPublished ? 'outline' : 'draft'} size="sm">
        {isPublished ? 'Опубликован' : 'Черновик'}
      </Badge>

      {/* Два самых частых «что тут недоделано». Запись без оглавления —
          это запись, которую посмотрят один раз и не вернутся */}
      <span className="text-content-muted w-32 shrink-0 text-sm">
        {stream.hasVideo
          ? stream.chapterCount > 0
            ? `запись · ${stream.chapterCount}`
            : 'запись без оглавления'
          : '—'}
      </span>
    </Link>
  )
}
