'use server'

import { z } from 'zod'

import { getSession } from '@/modules/identity/current-user'
import { recordPlayback } from '@/modules/progress/service'
import { errors } from '@/shared/errors'
import { defineAction } from '@/shared/server'

/**
 * Отметка о просмотре от плеера.
 *
 * ─────────────────────────────────────────────────────────────────
 * ОБЩЕЕ ДЕЙСТВИЕ ДЛЯ ВСЕХ ВИДОВ СОДЕРЖИМОГО
 *
 * Живёт в слое приложения, а не внутри курса или разборов: один плеер
 * показывает и урок, и разбор, и запись эфира. Три одинаковых
 * действия в трёх модулях разошлись бы при первой же правке.
 *
 * Прав здесь не проверяем, и это не упущение: прогресс всегда свой.
 * Идентификатор человека берётся из сессии, а не из запроса, — отметить
 * просмотр другому человеку невозможно, потому что для этого пришлось бы
 * прислать чужой идентификатор, а его никто не спрашивает.
 *
 * Страницы отсюда не обновляются. Отметка приходит каждые несколько
 * секунд во время просмотра; перерисовывать страницу под работающим
 * плеером — верный способ прервать воспроизведение.
 * ─────────────────────────────────────────────────────────────────
 */
export const recordPlaybackAction = defineAction({
  name: 'progress.playback',
  input: z.object({
    entityType: z.enum(['lesson', 'arrangement', 'stream']),
    entityId: z.uuid(),
    positionSec: z
      .number()
      .min(0)
      .max(24 * 60 * 60),
    durationSec: z
      .number()
      .min(0)
      .max(24 * 60 * 60)
      .nullable(),
  }),
  handler: async ({ entityType, entityId, positionSec, durationSec }) => {
    const session = await getSession()
    if (!session) throw errors.unauthorized()

    const result = await recordPlayback({
      userId: session.user.id,
      entityType,
      entityId,
      positionSec,
      durationSec,
    })

    return { completed: result.completed, percent: result.percent }
  },
})
