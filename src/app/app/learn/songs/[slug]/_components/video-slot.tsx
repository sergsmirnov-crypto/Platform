import { Lock, Video } from 'lucide-react'

import { songStrings } from '@/modules/songs'
import { routes } from '@/shared/routes'
import { LinkButton } from '@/ui'

/**
 * Место, где будет плеер.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ЗАГЛУШКА, А НЕ ОТСУТСТВИЕ БЛОКА
 *
 * Видеохостинг подключается на шаге 5.4, и до тех пор проигрывать
 * нечего. Но пустое место наверху страницы человек читает как поломку
 * вёрстки, а куратор — как «видео не загрузилось». Честная плашка
 * с объяснением снимает оба вопроса и, в отличие от пустоты, задаёт
 * плееру размеры: подключение хостинга не сдвинет всю страницу.
 * ─────────────────────────────────────────────────────────────────
 *
 * Два разных состояния, и путать их нельзя. «Видео пока не загружено» —
 * это про содержимое и лечится куратором. «Доступно по подписке» —
 * про деньги и лечится участником. Одинаковая плашка на оба случая
 * отправила бы человека не туда.
 */

type VideoSlotProps = {
  /** Есть ли у части или разбора видео вообще */
  hasVideo: boolean
  /** Оплачен ли доступ к платному содержимому */
  hasAccess: boolean
}

export function VideoSlot({ hasVideo, hasAccess }: VideoSlotProps) {
  if (!hasAccess) {
    return (
      <Frame>
        <Lock size={28} className="text-content-subtle" aria-hidden />
        <p className="mt-3 font-medium">{songStrings.access.videoLocked}</p>
        <p className="text-content-muted mt-1 max-w-sm text-sm">{songStrings.access.lockedHint}</p>
        <LinkButton href={routes.app.subscriptionExpired()} size="sm" className="mt-5">
          {songStrings.access.renew}
        </LinkButton>
      </Frame>
    )
  }

  return (
    <Frame>
      <Video size={28} className="text-content-subtle" aria-hidden />
      <p className="mt-3 font-medium">{songStrings.song.noVideo}</p>
      <p className="text-content-muted mt-1 max-w-sm text-sm">
        {hasVideo ? 'Плеер появится на следующем шаге' : songStrings.song.noVideoHint}
      </p>
    </Frame>
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
