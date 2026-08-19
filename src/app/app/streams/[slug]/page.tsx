import { Lock, Video } from 'lucide-react'
import { notFound } from 'next/navigation'

import { findTelegramUsername } from '@/modules/identity'
import { getSession } from '@/modules/identity/current-user'
import { getNotes } from '@/modules/library/notes-service'
import { isFavorite } from '@/modules/library/service'
import { getPlaybackTicket } from '@/modules/media/service'
import { getProgress } from '@/modules/progress/service'
import { formatArchiveDate, formatDuration, streamStrings } from '@/modules/streams'
import type { StreamView } from '@/modules/streams'
import { getStreamBySlug } from '@/modules/streams/service'
import { hasActiveAccess } from '@/modules/subscription'
import { routes } from '@/shared/routes'
import { Badge, EmptyState, LinkButton } from '@/ui'

import { FavoriteButton } from '../../_components/favorite-button'
import { MaterialsList } from '../../_components/materials-list'
import { NotesPanel } from '../../_components/notes/notes-panel'
import { PageIntro } from '../../_components/page-intro'
import { PlaybackProvider } from '../../_components/playback-context'
import { parseSeconds } from '../../_lib/query'
import { getContentViewer } from '../../_lib/viewer'

import { ChapterList, ChaptersHeading } from './_components/chapter-list'
import { StreamSongs } from './_components/stream-songs'
import { StreamWatchArea } from './_components/stream-watch-area'
import { UpcomingPanel } from './_components/upcoming-panel'

import type { Metadata } from 'next'

/**
 * Страница эфира — до, во время и после.
 *
 * ─────────────────────────────────────────────────────────────────
 * ОДНА СТРАНИЦА НА ТРИ СОСТОЯНИЯ, А НЕ ТРИ СТРАНИЦЫ
 *
 * Анонс, идущий эфир и запись — это один эфир на разных этапах жизни
 * (решение шага 7.1). Адрес у него один и тот же: ссылка, сохранённая
 * из анонса, через неделю приводит к записи, а не в никуда. Разделение
 * на страницы сломало бы именно это — самое ценное свойство раздела.
 *
 * Меняется только верхний блок:
 *   до эфира  → когда, куда идти, добавить в календарь
 *   во время  → то же плюс кнопка «Присоединиться»
 *   после     → плеер с оглавлением
 *
 * Низ страницы одинаков всегда: оглавление, разобранные песни,
 * материалы. Оглавление видно даже без подписки — оно и есть лучший
 * довод её продлить.
 * ─────────────────────────────────────────────────────────────────
 *
 * Право видеть черновики и оплаченный доступ — разные вещи, как
 * и на странице разбора: куратор без подписки видит структуру, но
 * не запись; участник с подпиской видит запись, но не черновики.
 */

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const viewer = await getContentViewer('streams.view_drafts')
  if (!viewer) return { title: streamStrings.title }

  const { slug } = await params
  const stream = await getStreamBySlug(viewer, slug).catch(() => null)

  if (!stream) return { title: streamStrings.title }

  return { title: stream.title, description: stream.description ?? undefined }
}

export default async function StreamPage({ params, searchParams }: Props) {
  const viewer = await getContentViewer('streams.view_drafts')
  if (!viewer) return null

  const [{ slug }, query] = await Promise.all([params, searchParams])

  // Эфира либо нет, либо он ещё не опубликован для этого человека.
  // Разницу наружу не показываем: она сообщила бы постороннему,
  // что черновик с таким адресом существует
  const stream = await getStreamBySlug(viewer, slug).catch(() => null)
  if (!stream) notFound()

  const [hasAccess, progress, favorite, notes] = await Promise.all([
    hasActiveAccess(viewer.userId),
    getProgress(viewer.userId, 'stream', stream.id),
    // Отложить можно и анонс: человек увидел тему, отметил «хочу
    // посмотреть» и вернётся через неделю уже к записи — по тому же адресу
    isFavorite(viewer.userId, { entityType: 'stream', entityId: stream.id }),
    getNotes(viewer.userId, { entityType: 'stream', entityId: stream.id }),
  ])

  const ticket = stream.videoAssetId && hasAccess ? await playbackFor(viewer.userId, stream) : null

  // Ссылка на момент записи: `?t=2820` открывает эфир на 47-й минуте.
  // Нужна кураторам — в чате отвечают «смотри вот здесь» одной ссылкой.
  // Она сильнее сохранённого места просмотра: человек пришёл по ней
  // осознанно, и возврат «куда ты дошёл в прошлый раз» был бы досадой
  const startAt = parseSeconds(query.t)
  const resumeAt = startAt ?? progress.positionSec

  return (
    <>
      <PageIntro
        title={stream.title}
        description={stream.description ?? undefined}
        actions={<FavoriteButton entityType="stream" entityId={stream.id} initial={favorite} />}
      />

      <p className="text-content-muted mb-8 flex flex-wrap items-center gap-2 text-sm">
        <span>{formatArchiveDate(stream.startsAt)}</span>
        {stream.curatorName ? (
          <span>
            · {streamStrings.page.curator}: {stream.curatorName}
          </span>
        ) : null}
        {stream.durationSec ? <span>· {formatDuration(stream.durationSec)}</span> : null}
        {stream.isDraft ? <Badge variant="draft">{streamStrings.page.draft}</Badge> : null}
      </p>

      <PlaybackProvider>
        <div className="space-y-10">
          {stream.phase === 'cancelled' ? (
            <CancelledNotice />
          ) : stream.phase === 'upcoming' || stream.phase === 'live' ? (
            <UpcomingPanel stream={stream} />
          ) : ticket ? (
            <StreamWatchArea
              ticket={ticket}
              chapters={stream.chapters}
              title={stream.title}
              // Плеер сам вернёт человека к месту остановки и сам отметит
              // просмотр: страница об этом больше ничего не знает
              tracking={{ entityType: 'stream', entityId: stream.id, resumeAt }}
            />
          ) : (
            <VideoSlot hasVideo={stream.videoAssetId !== null} hasAccess={hasAccess} />
          )}

          {/* Оглавление вне области просмотра показывается только тогда,
            когда плеера нет: иначе оно уже стоит под ним и переходит
            по нажатию */}
          {!ticket && stream.chapters.length > 0 ? (
            <section>
              <ChaptersHeading interactive={false} />
              <ChapterList chapters={stream.chapters} />
            </section>
          ) : null}

          <StreamSongs songs={stream.songs} />

          {stream.materials.length > 0 ? (
            <section>
              <h2 className="font-display mb-4 text-xl font-bold">
                {streamStrings.page.materials}
              </h2>
              <MaterialsList materials={stream.materials} hasAccess={hasAccess} />
            </section>
          ) : null}

          {/* Заметки внутри той же обёртки, что и плеер: только так время
            у заметки становится кнопкой, перематывающей запись */}
          <NotesPanel entityType="stream" entityId={stream.id} initialNotes={notes} />
        </div>
      </PlaybackProvider>

      <div className="mt-12">
        <LinkButton href={routes.app.streams.index()} variant="secondary" size="sm">
          {streamStrings.page.backToList}
        </LinkButton>
      </div>
    </>
  )
}

/**
 * Разрешение на просмотр записи.
 *
 * Имя участника уходит на водяной знак — главная мера против пересылки
 * записи в чужой чат (PRD v0.2 §2.2). Оглавление передаётся плееру,
 * чтобы пункты стали точками на полосе воспроизведения: их видно
 * и в полноэкранном режиме, где списка на странице не видно.
 */
async function playbackFor(userId: string, stream: StreamView) {
  if (!stream.videoAssetId) return null

  const [session, username] = await Promise.all([getSession(), findTelegramUsername(userId)])
  if (!session) return null

  return getPlaybackTicket(
    { id: userId, displayName: session.user.displayName, username },
    {
      assetId: stream.videoAssetId,
      startSec: null,
      chapters: stream.chapters.map((chapter) => ({
        title: chapter.title,
        startSec: chapter.startSec,
      })),
    },
  )
}

/**
 * Место, где был бы плеер.
 *
 * Два разных состояния, и путать их нельзя. «Записи пока нет» — про
 * содержимое, лечится куратором. «Доступно по подписке» — про деньги,
 * лечится участником. Одинаковая плашка отправила бы человека не туда.
 */
function VideoSlot({ hasVideo, hasAccess }: { hasVideo: boolean; hasAccess: boolean }) {
  if (hasVideo && !hasAccess) {
    return (
      <Frame>
        <Lock size={28} className="text-content-subtle" aria-hidden />
        <p className="mt-3 font-medium">{streamStrings.page.videoLocked}</p>
        <p className="text-content-muted mt-1 max-w-sm text-sm">{streamStrings.page.lockedHint}</p>
        <LinkButton href={routes.app.subscriptionExpired()} size="sm" className="mt-5">
          {streamStrings.page.renew}
        </LinkButton>
      </Frame>
    )
  }

  return (
    <Frame>
      <Video size={28} className="text-content-subtle" aria-hidden />
      <p className="mt-3 font-medium">{streamStrings.page.noVideo}</p>
      <p className="text-content-muted mt-1 max-w-sm text-sm">{streamStrings.page.noVideoHint}</p>
    </Frame>
  )
}

/**
 * Отменённый эфир.
 *
 * Из ближайших он убран, но со страницы не исчезает: человек, открывший
 * сохранённую ссылку, должен понять, что эфир отменили, а не решить,
 * что он его проспал.
 */
function CancelledNotice() {
  return (
    <EmptyState
      title={streamStrings.page.cancelled}
      description={streamStrings.list.archiveHint}
      action={
        <LinkButton href={routes.app.streams.upcoming()} variant="secondary">
          {streamStrings.list.allUpcoming}
        </LinkButton>
      }
      className="border-border rounded-lg border border-dashed"
    />
  )
}

/** Пропорции кадра заданы заранее, чтобы плеер встал без сдвига страницы */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-border bg-surface-sunken flex aspect-video w-full flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center">
      {children}
    </div>
  )
}
