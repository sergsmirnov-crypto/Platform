'use server'

import { z } from 'zod'

import { getMemberSettings } from '@/modules/access/team'
import { getSession } from '@/modules/identity/current-user'
import { getMembersPage } from '@/modules/identity/directory'
import { DEFAULT_MEMBER_FILTERS } from '@/modules/identity/directory-filters'
import { errors } from '@/shared/errors'
import { defineAction } from '@/shared/server'

/**
 * Чтение по требованию для панелей экрана «Команда».
 *
 * Настройки прав и поиск по участникам подгружаются в момент открытия
 * панели, а не заранее для всех: сорок прав на десятерых — четыреста
 * строк, которые почти никогда не понадобятся, а список участников
 * на этом экране нужен только при добавлении.
 *
 * Права проверяются в модуле, как и везде: то, что панель открылась,
 * ничего не разрешает.
 */

async function actorId(): Promise<string> {
  const session = await getSession()
  if (!session) throw errors.unauthorized()

  return session.user.id
}

export const loadMemberSettings = defineAction({
  name: 'team.loadSettings',
  input: z.object({ userId: z.uuid() }),
  handler: async ({ userId }) => getMemberSettings(await actorId(), userId),
})

export const searchMembers = defineAction({
  name: 'team.searchMembers',
  input: z.object({ query: z.string().trim().max(100) }),
  handler: async ({ query }) => {
    const page = await getMembersPage(await actorId(), {
      ...DEFAULT_MEMBER_FILTERS,
      query: query || null,
      sort: 'name',
    })

    return page.members.map((member) => ({
      userId: member.userId,
      displayName: member.displayName,
      avatarUrl: member.avatarUrl,
      telegramUsername: member.telegramUsername,
      hasRole: member.roles.length > 0,
    }))
  },
})
