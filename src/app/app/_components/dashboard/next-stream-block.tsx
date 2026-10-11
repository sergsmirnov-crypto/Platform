import { Radio } from 'lucide-react'
import Link from 'next/link'

import { formatStreamDateTime, streamStrings, timeUntil } from '@/modules/streams'
import { getNextStream } from '@/modules/streams/service'
import { routes } from '@/shared/routes'

import { getContentViewer } from '../../_lib/viewer'
import { LocalTime } from '../../streams/_components/local-time'

/**
 * Ближайший эфир на главной.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЕДИНСТВЕННОЕ НА ПЛАТФОРМЕ, ЧТО НЕЛЬЗЯ ПОСМОТРЕТЬ ПОЗЖЕ
 *
 * Разбор и урок подождут; эфир идёт в конкретный час, и пропущенный
 * эфир человек смотрит записью — то есть без возможности спросить.
 * Поэтому анонс стоит на главной, а не только в своём разделе.
 *
 * Блок сам решает, показываться ли: между эфирами его нет вовсе.
 * Пустая рамка «ближайших эфиров не назначено» на главной занимала бы
 * место и сообщала бы ровно ничего (PRD v0.1 §5.1).
 * ─────────────────────────────────────────────────────────────────
 */
export async function NextStreamBlock() {
  const viewer = await getContentViewer('streams.view_drafts')
  if (!viewer) return null

  const stream = await getNextStream(viewer)
  if (!stream) return null

  const isLive = stream.phase === 'live'
  const until = timeUntil(stream.startsAt, new Date())

  return (
    <section>
      <h2 className="text-content-muted mb-3 text-sm font-semibold tracking-wide uppercase">
        {streamStrings.dashboard.title}
      </h2>

      <Link
        href={routes.app.streams.stream(stream.slug)}
        className="border-border bg-surface-raised hover:border-border-strong group block rounded-xl border p-5 transition-colors"
      >
        <div className="flex items-center gap-4">
          <span
            className={
              isLive
                ? 'bg-danger text-danger-content flex size-12 shrink-0 items-center justify-center rounded-full'
                : 'bg-surface-sunken text-content-muted flex size-12 shrink-0 items-center justify-center rounded-full'
            }
          >
            <Radio size={20} aria-hidden />
          </span>

          <span className="min-w-0 flex-1">
            <span className="text-content-muted block text-xs">
              {isLive ? streamStrings.phase.live : until}
            </span>
            <span className="group-hover:text-accent-hover block truncate text-lg font-semibold transition-colors">
              {stream.title}
            </span>
            <span className="text-content-muted block truncate text-sm">
              {formatStreamDateTime(stream.startsAt)} {streamStrings.page.timezone}
              {stream.curatorName ? ` · ${stream.curatorName}` : ''}
            </span>
            <span className="block text-sm">
              <LocalTime startsAt={stream.startsAt} />
            </span>
          </span>
        </div>
      </Link>
    </section>
  )
}
