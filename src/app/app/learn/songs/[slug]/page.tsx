import { Music4 } from 'lucide-react'
import { notFound } from 'next/navigation'

import { findTelegramUsername } from '@/modules/identity'
import { getSession } from '@/modules/identity/current-user'
import { getNotes } from '@/modules/library/notes-service'
import { isFavorite } from '@/modules/library/service'
import { getPlaybackTicket } from '@/modules/media/service'
import { getProgress } from '@/modules/progress/service'
import { isLevel, selectArrangement, songStrings } from '@/modules/songs'
import type { ArrangementView } from '@/modules/songs'
import { getPreferredLevel, getSimilarSongs, getSongBySlug } from '@/modules/songs/service'
import { getStreamsForSong } from '@/modules/streams/service'
import { hasActiveAccess } from '@/modules/subscription'
import { appConfig } from '@/shared/config/app.config'
import { routes } from '@/shared/routes'
import { EmptyState, LinkButton } from '@/ui'

import { FavoriteButton } from '../../../_components/favorite-button'
import { MaterialsList } from '../../../_components/materials-list'
import { NotesPanel } from '../../../_components/notes/notes-panel'
import { PageIntro } from '../../../_components/page-intro'
import { PlaybackProvider } from '../../../_components/playback-context'
import { parseSeconds, single } from '../../../_lib/query'
import { getContentViewer } from '../../../_lib/viewer'

import { ArrangementSummary } from './_components/arrangement-summary'
import { LevelSwitch } from './_components/level-switch'
import { SectionList } from './_components/section-list'
import { SimilarSongs } from './_components/similar-songs'
import { SongHero } from './_components/song-hero'
import { SongStreams } from './_components/song-streams'
import { VideoSlot } from './_components/video-slot'
import { WatchArea } from './_components/watch-area'

import type { Metadata } from 'next'

/**
 * Страница разбора песни.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЧТО ЗДЕСЬ ПРОИСХОДИТ, СВЕРХУ ВНИЗ
 *
 *   1. кто смотрит и видит ли он черновики  → getContentViewer
 *   2. песня со всеми вариантами            → getSongBySlug
 *   3. какой вариант открыть                → selectArrangement
 *   4. оплачен ли доступ к содержимому      → hasActiveAccess
 *
 * Шаги 1 и 4 разные, и это принципиально. Право видеть черновики —
 * про роль куратора; оплаченный доступ — про подписку. Куратор без
 * подписки видит структуру, но не видео; участник с подпиской видит
 * видео, но не черновики. Смешать их означало бы либо закрыть
 * платформу кураторам, либо открыть черновики всем.
 * ─────────────────────────────────────────────────────────────────
 *
 * Страница собирается целиком на сервере. Кода в браузере на ней нет
 * вовсе: переключатель уровней — ссылки, скачивание — ссылки. Это
 * не аскетизм ради аскетизма, а то, что страница открывается за один
 * запрос и работает на плохой связи с телефона, стоящего на пюпитре.
 */

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Заголовок вкладки: по нему человек находит страницу среди двадцати открытых */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const viewer = await getContentViewer('songs.view_drafts')
  if (!viewer) return { title: songStrings.catalog.title }

  const { slug } = await params
  const song = await getSongBySlug(viewer, slug)

  if (!song) return { title: songStrings.catalog.title }

  return {
    title: `${song.title} — ${song.artist}`,
    description: song.description ?? undefined,
  }
}

export default async function SongPage({ params, searchParams }: Props) {
  const viewer = await getContentViewer('songs.view_drafts')
  if (!viewer) return null

  const [{ slug }, query] = await Promise.all([params, searchParams])
  const song = await getSongBySlug(viewer, slug)

  // Разбор либо не существует, либо ещё не опубликован для этого человека.
  // Разницу наружу не показываем: она сообщила бы посторонему, что
  // черновик с таким адресом существует
  if (!song) notFound()

  const requestedLevel = single(query.level)
  const preferredLevel = await getPreferredLevel(viewer.userId)

  const { arrangement, groups, siblings } = selectArrangement(song.arrangements, {
    requestedLevel: isLevel(requestedLevel) ? requestedLevel : null,
    requestedId: single(query.v),
    profileLevel: preferredLevel,
  })

  const [hasAccess, similar, streams, progress, favorite, notes] = await Promise.all([
    hasActiveAccess(viewer.userId),
    getSimilarSongs(song.id, appConfig.catalog.similarCount),
    // Эфиры разрешает слой приложения: модулю разборов запрещено
    // обращаться к модулю эфиров напрямую, и это правильно — разборы
    // не должны знать, что эфиры вообще существуют
    getStreamsForSong(viewer, song.id),
    // Прогресс у варианта разбора, а не у песни: человек проходит
    // конкретный уровень от конкретного куратора (ADR-0019)
    arrangement ? getProgress(viewer.userId, 'arrangement', arrangement.id) : Promise.resolve(null),
    // Отложено — у песни, а не у варианта разбора: откладывают
    // «Nothing Else Matters», а не «средний уровень от Ивана» (ADR-0023)
    isFavorite(viewer.userId, { entityType: 'song', entityId: song.id }),
    // Заметки — у варианта разбора, а не у песни: пометка про 2:14
    // относится к конкретной записи, и у другого уровня она другая
    arrangement
      ? getNotes(viewer.userId, { entityType: 'arrangement', entityId: arrangement.id })
      : Promise.resolve([]),
  ])

  // Ссылка на момент записи: `?t=134` открывает разбор на 2:14. Ею
  // пользуются заметки — «здесь застреваю» открывается сразу на месте.
  // Она сильнее сохранённого места просмотра: человек пришёл по ней
  // осознанно, и возврат «куда ты дошёл в прошлый раз» был бы досадой
  const startAt = parseSeconds(query.t)
  const resumeAt = startAt ?? progress?.positionSec ?? 0

  // Разрешение на просмотр собирается только тогда, когда смотреть есть что
  // и есть кому: лишний ключ воспроизведения — это лишняя строка в разметке,
  // которую кто-то однажды попробует переиспользовать
  const ticket = arrangement && hasAccess ? await playbackFor(viewer.userId, arrangement) : null

  // Материалы песни и материалы конкретного варианта показываются вместе:
  // человеку неважно, к чему куратор привязал минусовку, ему важно,
  // что она есть
  const materials = [...song.materials, ...(arrangement?.materials ?? [])]

  return (
    <>
      <PageIntro
        title={song.title}
        actions={<FavoriteButton entityType="song" entityId={song.id} initial={favorite} />}
      />

      <SongHero song={song} />

      {/* Плеер и заметки — внутри одной обёртки: только так время
          у заметки становится кнопкой, перематывающей запись */}
      <PlaybackProvider>
        {arrangement ? (
          <>
            <div className="mt-10">
              <LevelSwitch
                slug={song.slug}
                groups={groups}
                siblings={siblings}
                current={arrangement}
              />

              {/* Вход в режим репетиции показывается только тогда, когда
                  есть что репетировать: кнопка, ведущая к пустому экрану,
                  хуже её отсутствия */}
              {ticket ? (
                <LinkButton
                  href={`${routes.app.learn.rehearse(song.slug)}?v=${arrangement.id}`}
                  className="mt-4"
                >
                  <Music4 size={18} aria-hidden />
                  Режим репетиции
                </LinkButton>
              ) : null}
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="min-w-0 space-y-10">
                {ticket ? (
                  <WatchArea
                    ticket={ticket}
                    sections={arrangement.sections}
                    title={song.title}
                    tracking={{
                      entityType: 'arrangement',
                      entityId: arrangement.id,
                      resumeAt,
                    }}
                  />
                ) : (
                  <>
                    <VideoSlot hasVideo={hasAnyVideo(arrangement)} hasAccess={hasAccess} />

                    <section>
                      <h2 className="font-display mb-4 text-xl font-bold">
                        {songStrings.song.structure}
                      </h2>
                      <SectionList sections={arrangement.sections} />
                    </section>
                  </>
                )}

                <section>
                  <h2 className="font-display mb-4 text-xl font-bold">
                    {songStrings.song.materials}
                  </h2>
                  <MaterialsList materials={materials} hasAccess={hasAccess} />
                </section>
              </div>

              {/* Сводка держится в поле зрения при прокрутке структуры:
                уровень и куратор — то, к чему возвращаются глазами */}
              <aside className="lg:sticky lg:top-24 lg:self-start">
                <ArrangementSummary arrangement={arrangement} />
              </aside>
            </div>
          </>
        ) : (
          <div className="mt-10">
            <EmptyState
              title={songStrings.song.noArrangements}
              description={songStrings.song.noArrangementsHint}
              action={
                <LinkButton href={routes.app.learn.songs()} variant="secondary">
                  {songStrings.song.backToCatalog}
                </LinkButton>
              }
              className="border-border rounded-lg border border-dashed"
            />
          </div>
        )}

        {/* Заметки показываются только тогда, когда есть к чему их привязать:
            у песни без вариантов разбора нет ни записи, ни таймкодов */}
        {arrangement ? (
          <div className="mt-12">
            <NotesPanel entityType="arrangement" entityId={arrangement.id} initialNotes={notes} />
          </div>
        ) : null}
      </PlaybackProvider>

      <SongStreams streams={streams} />

      <SimilarSongs songs={similar} />
    </>
  )
}

/**
 * Разрешение на просмотр общего ролика разбора.
 *
 * Имя участника берётся из сессии и уходит на водяной знак: это главная
 * мера против пересылки записи в чужой чат (PRD v0.2 §2.2). Части разбора
 * превращаются в оглавление прямо на дорожке плеера.
 *
 * Возвращает `null`, если ролика ещё нет: страница тогда показывает
 * ту же честную плашку, что и раньше.
 */
async function playbackFor(userId: string, arrangement: ArrangementView) {
  const assetId = arrangement.sections.find((section) => section.playback)?.playback?.assetId
  if (!assetId) return null

  const [session, username] = await Promise.all([getSession(), findTelegramUsername(userId)])
  if (!session) return null

  return getPlaybackTicket(
    { id: userId, displayName: session.user.displayName, username },
    {
      assetId,
      startSec: null,
      chapters: arrangement.sections.map((section) => ({
        title: section.title,
        startSec: section.playback?.startSec ?? null,
      })),
    },
  )
}

/** Есть ли что проигрывать хотя бы в одной части — от этого зависит плашка */
function hasAnyVideo(arrangement: { sections: { playback: unknown }[] }): boolean {
  return arrangement.sections.some((section) => section.playback !== null)
}
