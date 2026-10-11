import { Radio } from 'lucide-react'
import Link from 'next/link'

import {
  formatArchiveDate,
  formatDuration,
  formatStreamDateTime,
  streamStrings,
  timeUntil,
} from '@/modules/streams'
import type { StreamCard } from '@/modules/streams'
import { routes } from '@/shared/routes'
import { Badge, Highlight } from '@/ui'

import { LocalTime } from './local-time'

/**
 * Карточка эфира — одна и для анонсов, и для архива.
 *
 * ─────────────────────────────────────────────────────────────────
 * ОДИН КОМПОНЕНТ, А НЕ ДВА ПОХОЖИХ
 *
 * Соблазн сделать «карточку анонса» и «карточку записи» велик: у первой
 * обратный отсчёт, у второй длительность. Но это один и тот же эфир
 * на разных этапах жизни — ровно так же, как в базе это одна строка,
 * а не две таблицы (решение шага 7.1).
 *
 * Две карточки означали бы два места, где правится оформление, и один
 * забытый при правке. Здесь различается только правая колонка.
 * ─────────────────────────────────────────────────────────────────
 *
 * Ссылкой сделана карточка целиком: попасть пальцем в строку заголовка
 * на телефоне трудно, а промахнуться мимо карточки невозможно.
 */

type StreamCardProps = {
  stream: StreamCard
  /** Слова из поискового запроса — подсветить, за что зацепился поиск */
  terms?: string[]
  /** Доля просмотра записи, 0–100. Показывается только у начатых */
  watchedPercent?: number
}

export function StreamCardItem({ stream, terms = [], watchedPercent = 0 }: StreamCardProps) {
  const isFuture = stream.phase === 'upcoming' || stream.phase === 'live'

  return (
    <Link
      href={routes.app.streams.stream(stream.slug)}
      className="group border-border bg-surface-raised hover:border-border-strong focus-visible:outline-focus-ring block overflow-hidden rounded-xl border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <div className="flex gap-4 p-5">
        <Cover coverUrl={stream.coverUrl} title={stream.title} />

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <PhaseBadge phase={stream.phase} />

            {stream.isDraft ? (
              <Badge variant="draft" size="sm">
                {streamStrings.page.draft}
              </Badge>
            ) : null}
          </div>

          <p className="group-hover:text-accent-hover font-display text-lg leading-snug font-bold transition-colors">
            <Highlight text={stream.title} terms={terms} />
          </p>

          {stream.description ? (
            <p className="text-content-muted mt-1 line-clamp-2 text-sm">
              <Highlight text={stream.description} terms={terms} />
            </p>
          ) : null}

          <div className="text-content-subtle mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {/* У анонса важен день недели и время, у записи — только дата:
                «во вторник в 20:00» для эфира годовой давности бесполезно */}
            <span>
              {isFuture
                ? `${formatStreamDateTime(stream.startsAt)} ${streamStrings.page.timezone}`
                : formatArchiveDate(stream.startsAt)}
            </span>

            {isFuture ? <LocalTime startsAt={stream.startsAt} /> : null}

            {stream.curatorName ? <span>· {stream.curatorName}</span> : null}

            {stream.durationSec ? <span>· {formatDuration(stream.durationSec)}</span> : null}
          </div>
        </div>

        <div className="hidden shrink-0 self-center sm:block">
          <RightColumn stream={stream} />
        </div>
      </div>

      {/* Полоса просмотра по нижнему краю: не занимает строки, но сразу
          отвечает на вопрос «я это уже смотрел?» */}
      {watchedPercent > 0 ? (
        <span className="bg-surface-sunken block h-1 w-full">
          <span
            className="bg-accent block h-full"
            style={{ width: `${Math.min(100, Math.max(watchedPercent, 2))}%` }}
          />
          <span className="sr-only">{streamStrings.list.watched(watchedPercent)}</span>
        </span>
      ) : null}
    </Link>
  )
}

/** Что показать справа: отсчёт до начала или длительность записи */
function RightColumn({ stream }: { stream: StreamCard }) {
  if (stream.phase === 'live') {
    return (
      <span className="bg-danger text-danger-content inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
        <span className="size-2 animate-pulse rounded-full bg-current" aria-hidden />
        {streamStrings.phase.live}
      </span>
    )
  }

  if (stream.phase === 'upcoming') {
    const until = timeUntil(stream.startsAt, new Date())

    return until ? <span className="text-content-muted text-sm">{until}</span> : null
  }

  return null
}

function PhaseBadge({ phase }: { phase: StreamCard['phase'] }) {
  if (phase === 'live') {
    return <Badge variant="danger">{streamStrings.phase.live}</Badge>
  }

  if (phase === 'cancelled') {
    return <Badge variant="outline">{streamStrings.phase.cancelled}</Badge>
  }

  if (phase === 'finished') {
    return <Badge variant="outline">{streamStrings.phase.finished}</Badge>
  }

  return <Badge variant="neutral">{streamStrings.phase[phase]}</Badge>
}

/**
 * Обложка.
 *
 * Своей обложки у эфира обычно нет — куратор её не делает, и требовать
 * не нужно. Вместо пустого прямоугольника — знак раздела: список
 * остаётся ровным, а карточка не выглядит сломанной.
 */
function Cover({ coverUrl, title }: { coverUrl: string | null; title: string }) {
  if (coverUrl) {
    return (
      // Обычный тег: адрес приходит из хранилища и не проходит
      // через оптимизатор изображений (см. решение шага 4.3)
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={coverUrl}
        alt=""
        className="hidden size-20 shrink-0 rounded-lg object-cover sm:block"
      />
    )
  }

  return (
    <span
      aria-hidden
      title={title}
      className="bg-surface-sunken text-content-subtle hidden size-20 shrink-0 items-center justify-center rounded-lg sm:flex"
    >
      <Radio size={24} />
    </span>
  )
}
