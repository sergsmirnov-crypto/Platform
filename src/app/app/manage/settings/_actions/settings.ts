'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { getRequestOrigin } from '@/modules/identity/cookie'
import { getSession } from '@/modules/identity/current-user'
import { hashClientIp } from '@/modules/identity/service'
import { resetSetting, updateSetting } from '@/modules/settings'
import { errors } from '@/shared/errors'
import { routes } from '@/shared/routes'
import { defineAction } from '@/shared/server'

/**
 * Сохранение настроек платформы.
 *
 * Здесь — «кто это и что он прислал»; право и правила проверки значений
 * живут в модуле `settings`. Адрес запроса хешируется и передаётся
 * дальше: модуль о запросах ничего не знает.
 */

async function actor(): Promise<{ userId: string; ipHash: string | null }> {
  const session = await getSession()
  if (!session) throw errors.unauthorized()

  const origin = await getRequestOrigin()

  return { userId: session.user.id, ipHash: hashClientIp(origin.ip) }
}

/**
 * Сброс кэша страниц, на которых видны настройки.
 *
 * Их четыре, и это не очевидно: карточки чатов стоят и на главной,
 * и на странице чатов, а ссылка продления — на экране закончившейся
 * подписки и в настройках профиля. Без перечисления человек правит
 * текст, обновляет страницу и видит старый.
 */
function revalidateSettings(): void {
  revalidatePath(routes.app.dashboard())
  revalidatePath(routes.app.club.about())
  revalidatePath(routes.app.club.telegram())
  revalidatePath(routes.app.me.settings())
  revalidatePath(routes.app.manage.settings())
}

export const saveSettingAction = defineAction({
  name: 'settings.save',
  input: z.object({
    key: z.string().min(1),
    /** Значение проверяется схемой настройки в модуле, а не здесь */
    value: z.unknown(),
  }),
  handler: async ({ key, value }) => {
    const { userId, ipHash } = await actor()

    await updateSetting(userId, key, value, { ipHash })
    revalidateSettings()

    return { key }
  },
})

export const resetSettingAction = defineAction({
  name: 'settings.reset',
  input: z.object({
    key: z.enum(['telegram.chats', 'subscription.renew_url', 'club.about']),
  }),
  handler: async ({ key }) => {
    const { userId, ipHash } = await actor()

    await resetSetting(userId, key, { ipHash })
    revalidateSettings()

    return { key }
  },
})
