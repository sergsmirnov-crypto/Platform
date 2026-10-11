'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { AUDIT_ACTIONS, recordAudit } from '@/modules/audit'
import { getSession } from '@/modules/identity/current-user'
import { linkExternalVideo } from '@/modules/media/service'
import { chaptersInputSchema, streamInputSchema, streamSongsInputSchema } from '@/modules/streams'
import {
  createStream,
  editStream,
  getStreamRef,
  removeStream,
  saveChapters,
  saveStreamSongs,
  setStreamPublished,
  setStreamState,
  setStreamVideo,
} from '@/modules/streams/editor-service'
import { errors } from '@/shared/errors'
import { routes } from '@/shared/routes'
import { defineAction } from '@/shared/server'

import { announceStreamRecording } from '../../../_lib/announce'

/**
 * Точки входа редактора эфиров.
 *
 * Здесь — «кто это и что он прислал»; в модуле — «что при этом можно
 * и по каким правилам». То же разделение, что у редакторов разборов
 * и курса (см. пояснение в `manage/songs/_actions/song-editor.ts`).
 */

async function actor(): Promise<string> {
  const session = await getSession()
  if (!session) throw errors.unauthorized()

  return session.user.id
}

/**
 * Сброс кэша.
 *
 * Эфир виден в четырёх местах: список управления, архив, страница
 * эфира и главная с блоком «Ближайший эфир». Обновлять только редактор
 * значило бы показывать куратору свежее там, где он правил,
 * и вчерашнее там, куда он пойдёт проверять результат.
 */
async function revalidateStream(streamId: string | null): Promise<void> {
  revalidatePath(routes.app.manage.streams())
  revalidatePath(routes.app.streams.index())
  revalidatePath(routes.app.streams.upcoming())
  revalidatePath(routes.app.dashboard())

  if (streamId) {
    revalidatePath(routes.app.manage.stream(streamId))
    revalidatePath(routes.app.streams.stream((await getStreamRef(streamId)).slug))
  }
}

export const createStreamAction = defineAction({
  name: 'stream.create',
  input: streamInputSchema,
  handler: async (values) => {
    const actorId = await actor()
    const id = await createStream(actorId, values)

    await recordAudit({
      actorId,
      action: AUDIT_ACTIONS.streamCreate,
      entityType: 'stream',
      entityId: id,
      entityTitle: values.title,
    })

    await revalidateStream(id)

    return { id }
  },
})

export const editStreamAction = defineAction({
  name: 'stream.edit',
  input: z.object({ streamId: z.uuid(), values: streamInputSchema }),
  handler: async ({ streamId, values }) => {
    await editStream(await actor(), streamId, values)
    await revalidateStream(streamId)

    return { saved: true }
  },
})

export const setStreamStateAction = defineAction({
  name: 'stream.state',
  input: z.object({
    streamId: z.uuid(),
    state: z.enum(['scheduled', 'live', 'recorded', 'cancelled']),
  }),
  handler: async ({ streamId, state }) => {
    await setStreamState(await actor(), streamId, state)
    await revalidateStream(streamId)

    return { state }
  },
})

export const setStreamPublishedAction = defineAction({
  name: 'stream.publish',
  input: z.object({ streamId: z.uuid(), published: z.boolean() }),
  handler: async ({ streamId, published }) => {
    const actorId = await actor()
    const ref = await getStreamRef(streamId)

    await setStreamPublished(actorId, streamId, published)
    await recordAudit({
      actorId,
      action: published ? AUDIT_ACTIONS.streamPublish : AUDIT_ACTIONS.streamUnpublish,
      entityType: 'stream',
      entityId: streamId,
      entityTitle: ref.title,
    })

    await revalidateStream(streamId)

    // Оповещаем только о появившейся записи, а не о самом факте
    // публикации: опубликованный анонс — ещё не повод писать людям,
    // что «запись готова». Снятие с публикации не оповещает никогда
    if (published && ref.hasVideo) {
      await announceStreamRecording({ title: ref.title, slug: ref.slug })
    }

    return { published }
  },
})

/**
 * Привязка записи.
 *
 * Идентификатор ролика из панели видеохостинга, как у разборов и уроков:
 * полуторачасовое видео через наш сервер не идёт и идти не должно
 * (ADR-0016). Пустое значение снимает запись с эфира.
 */
export const attachStreamVideoAction = defineAction({
  name: 'stream.video',
  input: z.object({
    streamId: z.uuid(),
    externalId: z.string().trim().min(1).max(200).nullable(),
  }),
  handler: async ({ streamId, externalId }) => {
    const actorId = await actor()
    const assetId = externalId ? await linkExternalVideo(externalId, actorId, null) : null

    await setStreamVideo(actorId, streamId, assetId)
    await revalidateStream(streamId)

    return { assetId }
  },
})

/**
 * Сохранение оглавления целиком.
 *
 * Не по пункту: куратор правит оглавление как текст — что-то дописал,
 * что-то стёр, где-то поправил время. Отдельные действия на пункт
 * означали бы десять обращений к серверу вместо одного и вопрос
 * «а сохранилось ли то, что я стёр».
 */
export const saveChaptersAction = defineAction({
  name: 'stream.chapters',
  input: z.object({ streamId: z.uuid() }).and(chaptersInputSchema),
  handler: async ({ streamId, chapters }) => {
    await saveChapters(await actor(), streamId, chapters)
    await revalidateStream(streamId)

    return { count: chapters.length }
  },
})

export const saveStreamSongsAction = defineAction({
  name: 'stream.songs',
  input: z.object({ streamId: z.uuid() }).and(streamSongsInputSchema),
  handler: async ({ streamId, songIds }) => {
    await saveStreamSongs(await actor(), streamId, songIds)
    await revalidateStream(streamId)

    return { count: songIds.length }
  },
})

export const deleteStreamAction = defineAction({
  name: 'stream.delete',
  input: z.object({ streamId: z.uuid() }),
  handler: async ({ streamId }) => {
    const actorId = await actor()

    // Адрес и название спрашиваем до удаления: после него спрашивать
    // будет не у кого, а страницу участника надо пометить устаревшей
    const { slug, title } = await getStreamRef(streamId)

    await removeStream(actorId, streamId)
    await recordAudit({
      actorId,
      action: AUDIT_ACTIONS.streamDelete,
      entityType: 'stream',
      entityId: streamId,
      entityTitle: title,
    })

    revalidatePath(routes.app.manage.streams())
    revalidatePath(routes.app.streams.index())
    revalidatePath(routes.app.streams.upcoming())
    revalidatePath(routes.app.streams.stream(slug))
    revalidatePath(routes.app.dashboard())

    return { deleted: true }
  },
})
