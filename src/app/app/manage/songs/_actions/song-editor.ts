'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { getSession } from '@/modules/identity/current-user'
import { linkExternalVideo } from '@/modules/media/service'
import {
  arrangementInputSchema,
  reorderSchema,
  sectionInputSchema,
  songInputSchema,
} from '@/modules/songs'
import {
  archiveSong,
  assertCanEditArrangement,
  attachVideo,
  createArrangement,
  createSong,
  editArrangement,
  editSong,
  publishSong,
  removeArrangement,
  removeSection,
  reorder,
  saveSection,
  setArrangementPublished,
  unpublishSong,
} from '@/modules/songs/editor-service'
import { errors } from '@/shared/errors'
import { routes } from '@/shared/routes'
import { defineAction } from '@/shared/server'

import { announceSong } from '../../../_lib/announce'

/**
 * Точки входа редактора разборов с фронтенда.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ЭТИ ДЕЙСТВИЯ ЖИВУТ В СЛОЕ ПРИЛОЖЕНИЯ, А НЕ В МОДУЛЕ
 *
 * Действию нужно знать, кто его вызвал, а это чтение cookie текущего
 * запроса. Модули такого делать не могут и не должны: тот же код
 * работает в процессе фоновых задач, где запроса нет вовсе, и в скрипте
 * переноса из Telegram, где нет и браузера. Правило проверяется линтером.
 *
 * Поэтому разделение такое: здесь — «кто это и что он прислал», в модуле —
 * «что при этом можно и по каким правилам». Скрипт переноса вызовет
 * тот же сервис напрямую, минуя этот файл, и все правила подействуют.
 * ─────────────────────────────────────────────────────────────────
 *
 * Каждое действие обёрнуто в `defineAction`: проверка данных, единый
 * формат ошибок, запись в журнал и отправка настоящих поломок в Sentry
 * происходят один раз в общем месте, а не сорок раз вручную.
 */

async function actor(): Promise<string> {
  const session = await getSession()
  if (!session) throw errors.unauthorized()

  return session.user.id
}

/**
 * Сброс кэша.
 *
 * Изменённый разбор виден в трёх местах: в управлении, в каталоге
 * и на своей странице. Обновлять только редактор значит показывать
 * куратору свежие данные там, где он их правил, и вчерашние — там,
 * где он пойдёт проверять результат.
 */
function revalidateSong(slug?: string | null): void {
  revalidatePath(routes.app.manage.songs())
  revalidatePath(routes.app.learn.songs())
  if (slug) revalidatePath(routes.app.learn.song(slug))
}

export const createSongAction = defineAction({
  name: 'songs.create',
  input: songInputSchema,
  handler: async (input) => {
    const songId = await createSong(await actor(), input)
    revalidateSong()

    return { songId }
  },
})

export const saveSongAction = defineAction({
  name: 'songs.edit',
  input: z.object({ songId: z.uuid(), values: songInputSchema }),
  handler: async ({ songId, values }) => {
    await editSong(await actor(), songId, values)
    revalidateSong()

    return { songId }
  },
})

export const publishSongAction = defineAction({
  name: 'songs.publish',
  input: z.object({ songId: z.uuid(), slug: z.string(), title: z.string(), artist: z.string() }),
  handler: async ({ songId, slug, title, artist }) => {
    await publishSong(await actor(), songId)
    revalidateSong(slug)

    // Оповещение клуба — после публикации и намеренно не в транзакции:
    // это следствие действия, а не его часть. Сбой рассылки не должен
    // превращать состоявшуюся публикацию в ошибку на экране куратора
    await announceSong({ title, artist, slug })

    return { published: true }
  },
})

export const unpublishSongAction = defineAction({
  name: 'songs.unpublish',
  input: z.object({ songId: z.uuid(), slug: z.string() }),
  handler: async ({ songId, slug }) => {
    await unpublishSong(await actor(), songId)
    revalidateSong(slug)

    return { published: false }
  },
})

export const archiveSongAction = defineAction({
  name: 'songs.archive',
  input: z.object({ songId: z.uuid(), slug: z.string() }),
  handler: async ({ songId, slug }) => {
    await archiveSong(await actor(), songId)
    revalidateSong(slug)

    return { archived: true }
  },
})

export const createArrangementAction = defineAction({
  name: 'songs.arrangement.create',
  input: z.object({
    songId: z.uuid(),
    values: arrangementInputSchema,
    template: z.string().default('standard'),
  }),
  handler: async ({ songId, values, template }) => {
    const arrangementId = await createArrangement(await actor(), songId, values, template)
    revalidateSong()

    return { arrangementId }
  },
})

export const saveArrangementAction = defineAction({
  name: 'songs.arrangement.edit',
  input: z.object({ arrangementId: z.uuid(), values: arrangementInputSchema }),
  handler: async ({ arrangementId, values }) => {
    await editArrangement(await actor(), arrangementId, values)
    revalidateSong()

    return { arrangementId }
  },
})

export const setArrangementPublishedAction = defineAction({
  name: 'songs.arrangement.publish',
  input: z.object({ arrangementId: z.uuid(), published: z.boolean() }),
  handler: async ({ arrangementId, published }) => {
    await setArrangementPublished(await actor(), arrangementId, published)
    revalidateSong()

    return { published }
  },
})

export const deleteArrangementAction = defineAction({
  name: 'songs.arrangement.delete',
  input: z.object({ arrangementId: z.uuid() }),
  handler: async ({ arrangementId }) => {
    await removeArrangement(await actor(), arrangementId)
    revalidateSong()

    return { deleted: true }
  },
})

export const attachVideoAction = defineAction({
  name: 'songs.arrangement.video',
  input: z.object({
    arrangementId: z.uuid(),
    // Пустая строка означает «отвязать»: отдельное действие для этого
    // завело бы вторую кнопку там, где хватает очистки поля
    externalId: z.string().trim().max(200),
  }),
  handler: async ({ arrangementId, externalId }) => {
    const actorId = await actor()

    // Порядок важен: сначала право трогать разбор, потом создание записи
    // о ролике. Иначе тот, у кого прав нет, наплодил бы записей
    await assertCanEditArrangement(actorId, arrangementId)

    const assetId = externalId ? await linkExternalVideo(externalId, actorId, null) : null

    await attachVideo(actorId, arrangementId, assetId)
    revalidateSong()

    return { linked: Boolean(assetId) }
  },
})

export const saveSectionAction = defineAction({
  name: 'songs.section.save',
  input: z.object({
    arrangementId: z.uuid(),
    values: sectionInputSchema,
    orderIndex: z.number().int().min(0),
  }),
  handler: async ({ arrangementId, values, orderIndex }) => {
    const sectionId = await saveSection(await actor(), arrangementId, values, orderIndex)
    revalidateSong()

    return { sectionId }
  },
})

export const deleteSectionAction = defineAction({
  name: 'songs.section.delete',
  input: z.object({ arrangementId: z.uuid(), sectionId: z.uuid() }),
  handler: async ({ arrangementId, sectionId }) => {
    await removeSection(await actor(), arrangementId, sectionId)
    revalidateSong()

    return { deleted: true }
  },
})

export const reorderSectionsAction = defineAction({
  name: 'songs.section.reorder',
  input: reorderSchema,
  handler: async ({ arrangementId, sectionIds }) => {
    await reorder(await actor(), arrangementId, sectionIds)
    revalidateSong()

    return { ordered: sectionIds.length }
  },
})
