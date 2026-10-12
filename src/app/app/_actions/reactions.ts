'use server'

import { z } from 'zod'

import { canSeeNews } from '@/modules/news/service'
import { reactionKeySchema, reactionTargetSchema } from '@/modules/reactions'
import type { ReactionTarget } from '@/modules/reactions'
import { setReaction } from '@/modules/reactions/service'
import type { ContentViewer } from '@/shared/content'
import { errors } from '@/shared/errors'
import { enforceRateLimit } from '@/shared/security/rate-limit'
import { defineAction } from '@/shared/server'

import { getContentViewer } from '../_lib/viewer'

/**
 * Поставить и снять реакцию (ADR-0032).
 *
 * ─────────────────────────────────────────────────────────────────
 * ОДНО ДЕЙСТВИЕ НА ВСЕ ВИДЫ ОБЪЕКТОВ — И ПРОВЕРКА ВИДИМОСТИ
 *
 * Живёт в слое приложения: панель одна и та же под новостью и (позже)
 * под окошком адвента. Модуль реакций не знает, к чему ставится реакция,
 * поэтому видимость проверяется здесь — у раздела, которому принадлежит
 * объект. Без этого реакция стала бы способом узнать о чужом черновике.
 *
 * Прав не проверяем: реакция всегда своя, человек берётся из сессии.
 * ─────────────────────────────────────────────────────────────────
 */

/** Сколько нажатий в минуту — защита от скрипта, а не от живого человека */
const RATE_LIMIT = { limit: 60, windowSeconds: 60 }

/** Видит ли человек объект, к которому ставит реакцию */
async function isVisible(viewer: ContentViewer, type: ReactionTarget, id: string) {
  switch (type) {
    case 'news_post':
      return canSeeNews(viewer, id)
  }
}

export const setReactionAction = defineAction({
  name: 'reactions.set',
  input: z.object({
    targetType: reactionTargetSchema,
    targetId: z.uuid(),
    /** Какая реакция должна стоять; `null` — снять свою */
    reaction: reactionKeySchema.nullable(),
  }),
  handler: async ({ targetType, targetId, reaction }) => {
    // Черновики видит тот, кто может их править: правило каждого раздела.
    // Пока раздел один — новости; с адвентом признак станет зависеть от вида
    const viewer = await getContentViewer('news.edit')
    if (!viewer) throw errors.unauthorized()

    enforceRateLimit({ action: 'reactions.set', subject: viewer.userId, ...RATE_LIMIT })

    // Снять свою можно всегда — даже с поста, который сняли с публикации:
    // иначе строка навсегда останется в базе
    if (reaction !== null && !(await isVisible(viewer, targetType, targetId))) {
      throw errors.notFound('Этого больше нет на платформе')
    }

    return setReaction(viewer.userId, { type: targetType, id: targetId }, reaction)
  },
})
