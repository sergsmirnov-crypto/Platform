import { Lock, Video } from 'lucide-react'
import { notFound } from 'next/navigation'

import { courseStrings } from '@/modules/course'
import { collectSongIds } from '@/modules/course'
import { getLessonPage } from '@/modules/course/service'
import { findTelegramUsername } from '@/modules/identity'
import { getNotes } from '@/modules/library/notes-service'
import { isFavorite } from '@/modules/library/service'
import { getPlaybackTicket } from '@/modules/media/service'
import { getProgress } from '@/modules/progress/service'
import { getSongsByIds } from '@/modules/songs/service'
import { hasActiveAccess } from '@/modules/subscription'
import { hasReadableContent } from '@/shared/blocks'
import { routes } from '@/shared/routes'
import { Badge, LinkButton } from '@/ui'

import { ContentBlocksView } from '../../../../_components/content-blocks'
import { FavoriteButton } from '../../../../_components/favorite-button'
import { NotesPanel } from '../../../../_components/notes/notes-panel'
import { PageIntro } from '../../../../_components/page-intro'
import { PlaybackProvider } from '../../../../_components/playback-context'
import { VideoPlayer } from '../../../../_components/video-player'
import { parseSeconds } from '../../../../_lib/query'
import { getContentViewer } from '../../../../_lib/viewer'

import { CompleteButton } from './_components/complete-button'
import { LessonNav } from './_components/lesson-nav'

import type { Metadata } from 'next'

/**
 * Страница урока.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОРЯДОК БЛОКОВ ЗАДАН ТЕМ, КАК УРОК ПРОХОДЯТ
 *
 *   1. видео          — с него начинают
 *   2. конспект       — к нему возвращаются с гитарой в руках
 *   3. «пройден»      — нажимают, закончив
 *   4. соседи         — уходят дальше
 *
 * Кнопка «пройден» стоит после конспекта, а не в шапке: в шапке её
 * нажимают, не открыв урок, и прогресс перестаёт что-либо означать.
 * ─────────────────────────────────────────────────────────────────
 *
 * Право видеть черновики и оплаченный доступ — разные вещи, как
 * и на странице разбора. Куратор без подписки видит структуру урока,
 * но не видео; участник с подпиской видит видео, но не черновики.
 */

type Props = {
  params: Promise<{ module: string; lesson: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const viewer = await getContentViewer('course.view_drafts')
  if (!viewer) return { title: courseStrings.title }

  const { module: moduleSlug, lesson: lessonSlug } = await params

  try {
    const { lesson } = await getLessonPage(viewer, moduleSlug, lessonSlug)

    return { title: lesson.title, description: lesson.summary ?? undefined }
  } catch {
    return { title: courseStrings.title }
  }
}

export default async function LessonPage({ params, searchParams }: Props) {
  const viewer = await getContentViewer('course.view_drafts')
  if (!viewer) return null

  const [{ module: moduleSlug, lesson: lessonSlug }, query] = await Promise.all([
    params,
    searchParams,
  ])

  const page = await getLessonPage(viewer, moduleSlug, lessonSlug).catch(() => null)

  // Урока либо нет, либо он ещё не опубликован для этого человека.
  // Разницу наружу не показываем: она сообщила бы постороннему,
  // что черновик с таким адресом существует
  if (!page) notFound()

  const { lesson, neighbours, number, totalLessons, completed } = page

  // Связанные разборы разрешает слой приложения: модулю курса
  // запрещено обращаться к модулю разборов напрямую, и это правильно —
  // курс не должен знать, как устроены песни
  const [hasAccess, songs, progress, favorite, notes] = await Promise.all([
    hasActiveAccess(viewer.userId),
    getSongsByIds(viewer, collectSongIds(lesson.content)),
    getProgress(viewer.userId, 'lesson', lesson.id),
    isFavorite(viewer.userId, { entityType: 'lesson', entityId: lesson.id }),
    getNotes(viewer.userId, { entityType: 'lesson', entityId: lesson.id }),
  ])

  // Ссылка на момент урока: `?t=134`. Ею пользуются заметки — «здесь
  // застреваю» открывается сразу на месте. Она сильнее сохранённого места
  // просмотра: человек пришёл по ней осознанно
  const resumeAt = parseSeconds(query.t) ?? progress.positionSec

  const ticket = lesson.videoAssetId && hasAccess ? await playbackFor(viewer.userId, lesson) : null

  return (
    <>
      <PageIntro
        title={lesson.title}
        description={lesson.summary ?? undefined}
        crumbTitles={{ [moduleSlug]: lesson.module.title }}
        actions={<FavoriteButton entityType="lesson" entityId={lesson.id} initial={favorite} />}
      />

      <p className="text-content-muted mt-1 flex flex-wrap items-center gap-2 text-sm">
        {number ? <span>{courseStrings.lesson.number(number, totalLessons)}</span> : null}
        {lesson.estimatedMinutes ? (
          <span>· {courseStrings.lesson.duration(lesson.estimatedMinutes)}</span>
        ) : null}
        {lesson.isDraft ? <Badge variant="draft">{courseStrings.lesson.draft}</Badge> : null}
      </p>

      <PlaybackProvider>
        <div className="mt-8 space-y-10">
          {ticket ? (
            <VideoPlayer
              ticket={ticket}
              title={lesson.title}
              // Плеер сам вернёт человека к месту остановки и сам отметит
              // просмотр: страница об этом больше ничего не знает
              tracking={{
                entityType: 'lesson',
                entityId: lesson.id,
                resumeAt,
              }}
            />
          ) : (
            <VideoSlot hasVideo={lesson.videoAssetId !== null} hasAccess={hasAccess} />
          )}

          {hasReadableContent(lesson.content) ? (
            <section>
              <h2 className="font-display mb-4 text-xl font-bold">
                {courseStrings.lesson.content}
              </h2>
              <ContentBlocksView blocks={lesson.content} songs={songs} />
            </section>
          ) : null}

          <CompleteButton
            lessonId={lesson.id}
            moduleSlug={moduleSlug}
            lessonSlug={lessonSlug}
            completed={completed}
          />

          <NotesPanel entityType="lesson" entityId={lesson.id} initialNotes={notes} />
        </div>
      </PlaybackProvider>

      <LessonNav neighbours={neighbours} currentModuleSlug={moduleSlug} />
    </>
  )
}

/**
 * Разрешение на воспроизведение.
 *
 * Собирается только когда смотреть есть что и есть кому: лишний ключ —
 * это лишняя строка в разметке, которую кто-то однажды попробует
 * переиспользовать.
 */
async function playbackFor(userId: string, lesson: { videoAssetId: string | null; title: string }) {
  if (!lesson.videoAssetId) return null

  const username = await findTelegramUsername(userId)

  return getPlaybackTicket(
    { id: userId, displayName: lesson.title, username },
    { assetId: lesson.videoAssetId, startSec: null, chapters: [] },
  )
}

/**
 * Место, где был бы плеер.
 *
 * Два разных состояния, и путать их нельзя. «Видео к уроку нет» — это
 * про содержимое и лечится куратором. «Доступно по подписке» — про
 * деньги и лечится участником. Одинаковая плашка на оба случая
 * отправила бы человека не туда.
 */
function VideoSlot({ hasVideo, hasAccess }: { hasVideo: boolean; hasAccess: boolean }) {
  if (!hasAccess && hasVideo) {
    return (
      <Frame>
        <Lock size={28} className="text-content-subtle" aria-hidden />
        <p className="mt-3 font-medium">{courseStrings.lesson.videoLocked}</p>
        <p className="text-content-muted mt-1 max-w-sm text-sm">
          {courseStrings.lesson.lockedHint}
        </p>
        <LinkButton href={routes.app.subscriptionExpired()} size="sm" className="mt-5">
          {courseStrings.lesson.renew}
        </LinkButton>
      </Frame>
    )
  }

  if (hasVideo) {
    return (
      <Frame>
        <Video size={28} className="text-content-subtle" aria-hidden />
        <p className="mt-3 font-medium">{courseStrings.lesson.noVideo}</p>
      </Frame>
    )
  }

  // Урока без видео здесь не бывает пустого места: конспект ниже — это
  // и есть весь урок, и рамка с объяснением только мешала бы читать
  return null
}

/** Пропорции кадра заданы заранее, чтобы плеер встал без сдвига страницы */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-border bg-surface-sunken flex aspect-video w-full flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center">
      {children}
    </div>
  )
}
