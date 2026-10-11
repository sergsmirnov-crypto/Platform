'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { getSession } from '@/modules/identity/current-user'
import { setUserFlag, USER_FLAGS } from '@/modules/identity/repository'
import { errors } from '@/shared/errors'
import { routes } from '@/shared/routes'
import { defineAction } from '@/shared/server'

/**
 * Отметки списка «Освойся в клубе».
 *
 * Проверки прав здесь нет: человек ставит отметки самому себе,
 * а идентификатор берётся из сессии — прислать чужой некуда.
 */

async function currentUserId(): Promise<string> {
  const session = await getSession()
  if (!session) throw errors.unauthorized()

  return session.user.id
}

/**
 * Человек нажал карточку перехода в чат клуба.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ЭТО ЕДИНСТВЕННЫЙ ПУНКТ С ЯВНОЙ ОТМЕТКОЙ
 *
 * Четыре остальных вычисляются из прогресса: открыл разбор, начал урок,
 * посмотрел эфир, загрузил фотографию. Чат живёт в Telegram, и узнать
 * оттуда, зашёл ли человек, платформа не может — бот видит вступление
 * в канал, но не чтение чата.
 *
 * Поэтому отмечается намерение: нажатие на карточку. Это неточно —
 * человек мог нажать и закрыть, — но альтернативы хуже. Ручная галочка
 * превратила бы список в самообман, а отсутствие пункта убрало бы
 * из знакомства самое ценное для сообщества: вопрос «как играть этот
 * такт» задают в чате, а не наедине с видео.
 * ─────────────────────────────────────────────────────────────────
 *
 * Дата, а не `true`: она пригодится, когда понадобится понять, через
 * сколько дней после входа люди доходят до чата. Логическое значение
 * такого вопроса не переживёт.
 */
export const markChatOpenedAction = defineAction({
  name: 'checklist.chatOpened',
  input: z.object({}),
  handler: async () => {
    await setUserFlag(await currentUserId(), USER_FLAGS.chatOpenedAt, new Date().toISOString())

    // Главная перерисуется при следующем открытии: обновлять её сейчас
    // незачем — человек уходит в Telegram, а не остаётся на странице
    return { ok: true }
  },
})

/**
 * Человек скрыл список.
 *
 * Скрытие окончательное: вернуть список нельзя. Это осознанно — кнопка
 * «показать снова» понадобилась бы одному человеку из ста, а пункт
 * в настройках ради неё увидели бы все.
 */
export const hideChecklistAction = defineAction({
  name: 'checklist.hide',
  input: z.object({}),
  handler: async () => {
    await setUserFlag(await currentUserId(), USER_FLAGS.checklistHiddenAt, new Date().toISOString())

    revalidatePath(routes.app.dashboard())
    return { ok: true }
  },
})
