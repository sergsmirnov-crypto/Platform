'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { markFeedRead, setPreference } from '@/modules/notifications/service'
import { errors } from '@/shared/errors'
import { routes } from '@/shared/routes'
import { defineAction } from '@/shared/server'

import { getViewer } from '../_lib/viewer'

/**
 * Действия с уведомлениями.
 *
 * Прав не проверяем: лента и настройки всегда свои. Идентификатор
 * человека берётся из сессии, а не из запроса.
 */

async function currentUserId(): Promise<string> {
  const viewer = await getViewer()
  if (!viewer.userId) throw errors.unauthorized()

  return viewer.userId
}

/**
 * Отметить всё прочитанным.
 *
 * Только целиком, без отметки по одному: уведомление читают, открывая
 * то, на что оно указывает, а возиться с галочками у списка новостей
 * никто не станет.
 */
export const markNotificationsReadAction = defineAction({
  name: 'notifications.read',
  input: z.object({}),
  handler: async () => {
    await markFeedRead(await currentUserId())

    // Обновляем и ленту, и остальные страницы: счётчик в шапке виден
    // отовсюду, и оставить его гореть после прочтения нельзя
    revalidatePath(routes.app.me.notifications())
    revalidatePath(routes.app.dashboard())

    return { read: true }
  },
})

export const setNotificationPreferenceAction = defineAction({
  name: 'notifications.preference',
  input: z.object({ type: z.string(), enabled: z.boolean() }),
  handler: async ({ type, enabled }) => {
    const preferences = await setPreference(await currentUserId(), type, enabled)

    revalidatePath(routes.app.me.settings())

    return { preferences }
  },
})
