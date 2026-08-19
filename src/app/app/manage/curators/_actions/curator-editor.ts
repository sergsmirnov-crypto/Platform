'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { curatorCardSchema } from '@/modules/club'
import {
  createCuratorCard,
  editCuratorCard,
  getCuratorCandidates,
  getOwnCurator,
  removeCuratorCard,
  reorderCurators,
  setCuratorPublic,
} from '@/modules/club/service'
import { avatarUrlFor } from '@/modules/identity'
import { getSession } from '@/modules/identity/current-user'
import { errors } from '@/shared/errors'
import { routes } from '@/shared/routes'
import { defineAction } from '@/shared/server'

/**
 * Точки входа редактора карточек кураторов.
 *
 * Здесь — «кто это и что он прислал»; в модуле — «что при этом можно».
 * Права проверяются там, а не здесь: то же действие однажды вызовут
 * из другого места, и проверка не должна остаться в старом.
 */

async function actor(): Promise<string> {
  const session = await getSession()
  if (!session) throw errors.unauthorized()

  return session.user.id
}

/**
 * Сброс кэша.
 *
 * Карточка видна в трёх местах: список кураторов, страница куратора
 * и экран управления. Адресное имя нужно, чтобы перечитать именно
 * ту страницу, а не все подряд.
 */
async function revalidateCurator(userId: string): Promise<void> {
  revalidatePath(routes.app.club.curators())
  revalidatePath(routes.app.manage.curators())
  revalidatePath(routes.app.manage.curator(userId))

  const card = await getOwnCurator(userId)
  if (card) revalidatePath(routes.app.club.curator(card.slug))
}

export const createCuratorCardAction = defineAction({
  name: 'curator.create',
  input: z.object({ userId: z.uuid() }),
  handler: async ({ userId }) => {
    await createCuratorCard(await actor(), userId)
    await revalidateCurator(userId)

    return { created: true }
  },
})

export const editCuratorCardAction = defineAction({
  name: 'curator.edit',
  input: z.object({ userId: z.uuid(), values: curatorCardSchema }),
  handler: async ({ userId, values }) => {
    await editCuratorCard(await actor(), userId, values)
    await revalidateCurator(userId)

    return { saved: true }
  },
})

/**
 * Показать или скрыть карточку.
 *
 * Отдельным действием, а не полем формы: это единственное свойство,
 * которое куратор меняет, ничего не редактируя, — заполнил страницу,
 * нажал «Показать». Внутри формы оно терялось бы среди полей.
 */
export const setCuratorPublicAction = defineAction({
  name: 'curator.visibility',
  input: z.object({ userId: z.uuid(), isPublic: z.boolean() }),
  handler: async ({ userId, isPublic }) => {
    await setCuratorPublic(await actor(), userId, isPublic)
    await revalidateCurator(userId)

    return { isPublic }
  },
})

export const reorderCuratorsAction = defineAction({
  name: 'curator.reorder',
  input: z.object({ userIds: z.array(z.uuid()).max(50) }),
  handler: async ({ userIds }) => {
    await reorderCurators(await actor(), userIds)

    revalidatePath(routes.app.club.curators())
    revalidatePath(routes.app.manage.curators())

    return { count: userIds.length }
  },
})

export const removeCuratorCardAction = defineAction({
  name: 'curator.delete',
  input: z.object({ userId: z.uuid() }),
  handler: async ({ userId }) => {
    // Адрес спрашиваем до удаления: после него спрашивать не у кого,
    // а страницу надо пометить устаревшей
    await revalidateCurator(userId)
    await removeCuratorCard(await actor(), userId)

    revalidatePath(routes.app.club.curators())
    revalidatePath(routes.app.manage.curators())

    return { deleted: true }
  },
})

/**
 * Поиск участников для новой карточки.
 *
 * Действие сервера, а не обработчик адреса: это чтение по запросу
 * из формы, без перехода и без файла. Права проверяются в модуле —
 * список участников виден не всякому, у кого есть своя карточка.
 */
export const searchCuratorCandidatesAction = defineAction({
  name: 'curator.candidates',
  input: z.object({ query: z.string().max(100) }),
  handler: async ({ query }) => {
    const candidates = await getCuratorCandidates(await actor(), query)

    return {
      candidates: candidates.map((candidate) => ({
        id: candidate.id,
        displayName: candidate.displayName,
        avatarUrl: avatarUrlFor(candidate.id, candidate.avatarId, 'sm'),
      })),
    }
  },
})
