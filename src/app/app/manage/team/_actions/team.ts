'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { assignRole, resetOverrides, setPermissionOverride } from '@/modules/access/team'
import { AUDIT_ACTIONS, recordAudit } from '@/modules/audit'
import { getRequestOrigin } from '@/modules/identity/cookie'
import { getSession } from '@/modules/identity/current-user'
import { hashClientIp } from '@/modules/identity/service'
import { errors } from '@/shared/errors'
import { routes } from '@/shared/routes'
import { defineAction } from '@/shared/server'

/**
 * Действия экрана «Команда».
 *
 * Здесь — «кто это и что он прислал». Все запреты живут в модуле:
 * то же действие однажды вызовут из другого места, и проверка
 * не должна остаться в старом.
 *
 * Адрес запроса хешируется и попадает в журнал. Для изменения прав это
 * не паранойя: «откуда это сделали» иногда единственное, что отличает
 * ошибку от чужого доступа к аккаунту администратора.
 *
 * Запись в журнал делается здесь, а не в модуле: модуль прав не может
 * зависеть от журнала, потому что журнал спрашивает у него право
 * `audit.view`. Так же устроены эфиры, курс и материалы.
 */

async function actor(): Promise<{ userId: string; ipHash: string | null }> {
  const session = await getSession()
  if (!session) throw errors.unauthorized()

  const origin = await getRequestOrigin()

  return { userId: session.user.id, ipHash: hashClientIp(origin.ip) }
}

function revalidateTeam(): void {
  revalidatePath(routes.app.manage.team())
  revalidatePath(routes.app.manage.members())
}

export const assignRoleAction = defineAction({
  name: 'team.assignRole',
  input: z.object({
    userId: z.uuid(),
    /** Пусто означает «убрать из команды» */
    roleCode: z.string().min(1).nullable(),
  }),
  handler: async ({ userId, roleCode }) => {
    const { userId: actorId, ipHash } = await actor()
    const change = await assignRole(actorId, userId, roleCode)

    await recordAudit({
      actorId,
      action: change.to.length > 0 ? AUDIT_ACTIONS.roleGrant : AUDIT_ACTIONS.roleRevoke,
      entityType: 'user',
      entityId: userId,
      diff: change,
      ipHash,
    })

    revalidateTeam()

    return { userId }
  },
})

export const setPermissionAction = defineAction({
  name: 'team.setPermission',
  input: z.object({
    userId: z.uuid(),
    permissionKey: z.string().min(1),
    effect: z.enum(['inherit', 'grant', 'deny']),
    scope: z.enum(['own', 'all']).nullable().default(null),
  }),
  handler: async ({ userId, permissionKey, effect, scope }) => {
    const { userId: actorId, ipHash } = await actor()

    await setPermissionOverride(actorId, userId, permissionKey, effect, scope)
    await recordAudit({
      actorId,
      action: AUDIT_ACTIONS.permissionOverride,
      entityType: 'user',
      entityId: userId,
      diff: { permissionKey, effect, scope },
      ipHash,
    })

    revalidateTeam()

    return { permissionKey, effect }
  },
})

export const resetOverridesAction = defineAction({
  name: 'team.resetOverrides',
  input: z.object({ userId: z.uuid() }),
  handler: async ({ userId }) => {
    const { userId: actorId, ipHash } = await actor()

    await resetOverrides(actorId, userId)
    await recordAudit({
      actorId,
      action: AUDIT_ACTIONS.permissionReset,
      entityType: 'user',
      entityId: userId,
      ipHash,
    })

    revalidateTeam()

    return { userId }
  },
})
