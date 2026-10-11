import { notFound, redirect } from 'next/navigation'

import { findTelegramUsername } from '@/modules/identity'
import { getSession } from '@/modules/identity/current-user'
import { canViewInline } from '@/modules/media'
import { getPlaybackTicket } from '@/modules/media/service'
import { getProgress } from '@/modules/progress/service'
import { isLevel, selectArrangement } from '@/modules/songs'
import type { ArrangementView } from '@/modules/songs'
import { getPreferredLevel, getSongBySlug } from '@/modules/songs/service'
import { hasActiveAccess } from '@/modules/subscription'
import { routes } from '@/shared/routes'

import { parseSeconds, single } from '../../../../_lib/query'
import { getContentViewer } from '../../../../_lib/viewer'

import { RehearsalShell } from './_components/rehearsal-shell'

export const metadata = { title: 'Режим репетиции' }

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Режим репетиции.
 *
 * ─────────────────────────────────────────────────────────────────
 * ОТДЕЛЬНЫЙ АДРЕС, А НЕ СОСТОЯНИЕ СТРАНИЦЫ РАЗБОРА
 *
 * Соблазн был: кнопка на странице песни, разворачивающая плеер
 * во весь экран. Отказался.
 *
 * Свой адрес даёт то, чего разворачивание не даёт: режим открывается
 * с телефона по ссылке, остаётся при перезагрузке, закрывается кнопкой
 * «назад» и — главное — не тянет за собой всё остальное содержимое
 * страницы разбора. Человеку с гитарой в руках не нужны ни описание,
 * ни похожие разборы, ни заметки; грузить их, чтобы тут же скрыть,
 * незачем.
 * ─────────────────────────────────────────────────────────────────
 *
 * Без подписки режим недоступен: смотреть нечего. Возвращаем на обычную
 * страницу песни — там объяснено, что происходит и как продлить.
 */
export default async function RehearsePage({ params, searchParams }: Props) {
  const viewer = await getContentViewer('songs.view_drafts')
  if (!viewer) return null

  const [{ slug }, query] = await Promise.all([params, searchParams])

  const song = await getSongBySlug(viewer, slug)
  if (!song) notFound()

  const requestedLevel = single(query.level)
  const preferredLevel = await getPreferredLevel(viewer.userId)

  const { arrangement } = selectArrangement(song.arrangements, {
    requestedLevel: isLevel(requestedLevel) ? requestedLevel : null,
    requestedId: single(query.v),
    profileLevel: preferredLevel,
  })

  const hasAccess = await hasActiveAccess(viewer.userId)

  // Нечего разучивать: нет варианта, нет записи или нет доступа.
  // Возвращаем на страницу песни, а не показываем пустой экран
  if (!arrangement || !hasAccess) redirect(routes.app.learn.song(slug))

  const [ticket, progress] = await Promise.all([
    playbackFor(viewer.userId, arrangement),
    getProgress(viewer.userId, 'arrangement', arrangement.id),
  ])

  if (!ticket) redirect(routes.app.learn.song(slug))

  const startAt = parseSeconds(query.t)

  return (
    <RehearsalShell
      ticket={ticket}
      // Табы песни и табы конкретного варианта показываются вместе:
      // общий PDF на песню и уточнение под уровень — обычное сочетание
      tabs={[...song.materials, ...arrangement.materials].filter(
        (material) => canViewInline(material.kind) && material.isReady,
      )}
      sections={arrangement.sections}
      title={song.title}
      artist={song.artist}
      songHref={`${routes.app.learn.song(slug)}?v=${arrangement.id}`}
      tempoBpm={song.tempoBpm}
      tracking={{
        entityType: 'arrangement',
        entityId: arrangement.id,
        resumeAt: startAt ?? progress?.positionSec ?? 0,
      }}
    />
  )
}

/**
 * Разрешение на просмотр.
 *
 * Повторяет то же, что делает страница разбора. Вынести общий помощник
 * можно, но он оказался бы функцией из шести строк с четырьмя
 * аргументами в третьем файле — а так каждая страница читается целиком
 * на месте.
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
