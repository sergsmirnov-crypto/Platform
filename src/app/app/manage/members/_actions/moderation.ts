'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { blockReasonSchema } from '@/modules/identity'
import { getRequestOrigin } from '@/modules/identity/cookie'
import { getSession } from '@/modules/identity/current-user'
import { blockMember, unblockMember } from '@/modules/identity/directory'
import { hashClientIp } from '@/modules/identity/service'
import { errors } from '@/shared/errors'
import { routes } from '@/shared/routes'
import { defineAction } from '@/shared/server'

/**
 * Блокировка участника.
 *
 * Здесь — «кто это и что он прислал»; в модуле — «что при этом можно».
 * Права и запреты проверяются там: то же действие однажды вызовут
 * из другого места, и проверка не должна остаться в старом.
 *
 * Адрес запроса хешируется и попадает в журнал вместе с записью.
 * Блокировка — действие, которое потом разбирают, и «откуда её сделали»
 * иногда единственное, что отличает ошибку от чужого доступа к аккаунту.
 */

async function actor(): Promise<{ userId: string; ipHash: string | null }> {
  const session = await getSession()
  if (!session) throw errors.unauthorized()

  const origin = await getRequestOrigin()

  return { userId: session.user.id, ipHash: hashClientIp(origin.ip) }
}

function revalidateMember(memberId: string): void {
  revalidatePath(routes.app.manage.members())
  revalidatePath(routes.app.manage.member(memberId))
}

export const blockMemberAction = defineAction({
  name: 'members.block',
  input: z.object({ userId: z.uuid(), reason: blockReasonSchema }),
  handler: async ({ userId, reason }) => {
    const { userId: actorId, ipHash } = await actor()

    await blockMember(actorId, userId, reason, { ipHash })
    revalidateMember(userId)

    return { blocked: true }
  },
})

export const unblockMemberAction = defineAction({
  name: 'members.unblock',
  input: z.object({ userId: z.uuid() }),
  handler: async ({ userId }) => {
    const { userId: actorId, ipHash } = await actor()

    await unblockMember(actorId, userId, { ipHash })
    revalidateMember(userId)

    return { unblocked: true }
  },
})
