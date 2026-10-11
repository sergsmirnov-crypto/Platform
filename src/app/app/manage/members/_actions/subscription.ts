'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { getRequestOrigin } from '@/modules/identity/cookie'
import { getSession } from '@/modules/identity/current-user'
import { hashClientIp } from '@/modules/identity/service'
import { grantAccess, revokeAccess } from '@/modules/subscription'
import { errors } from '@/shared/errors'
import { routes } from '@/shared/routes'
import { defineAction } from '@/shared/server'

/**
 * Ручное вмешательство в подписку.
 *
 * Причина обязательна у обоих действий, и это не формальность: ручная
 * выдача переживает события из Telegram, то есть человек может остаться
 * с доступом надолго после того, как перестал платить. Через месяц
 * ответить на вопрос «почему» должен журнал, а не память.
 */

async function actor(): Promise<{ userId: string; ipHash: string | null }> {
  const session = await getSession()
  if (!session) throw errors.unauthorized()

  const origin = await getRequestOrigin()

  return { userId: session.user.id, ipHash: hashClientIp(origin.ip) }
}

const reasonSchema = z
  .string()
  .trim()
  .min(5, 'Опишите причину: её прочитают через месяц')
  .max(500, 'Слишком длинно — оставьте суть')

function revalidateFor(userId: string): void {
  revalidatePath(routes.app.manage.subscriptions())
  revalidatePath(routes.app.manage.member(userId))
}

export const grantAccessAction = defineAction({
  name: 'subscriptions.grant',
  input: z.object({
    userId: z.uuid(),
    reason: reasonSchema,
    /** Пусто означает «без ограничения срока» */
    validUntil: z.iso.date().nullable().default(null),
  }),
  handler: async ({ userId, reason, validUntil }) => {
    const { userId: actorId, ipHash } = await actor()

    await grantAccess(actorId, userId, {
      reason,
      validUntil: validUntil ? new Date(validUntil) : null,
      ipHash,
    })
    revalidateFor(userId)

    return { userId }
  },
})

export const revokeAccessAction = defineAction({
  name: 'subscriptions.revoke',
  input: z.object({ userId: z.uuid(), reason: reasonSchema }),
  handler: async ({ userId, reason }) => {
    const { userId: actorId, ipHash } = await actor()

    await revokeAccess(actorId, userId, { reason, ipHash })
    revalidateFor(userId)

    return { userId }
  },
})
