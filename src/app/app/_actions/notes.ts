'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { noteRefSchema } from '@/modules/library'
import { createNote, editNote, removeNote } from '@/modules/library/notes-service'
import { errors } from '@/shared/errors'
import { routes } from '@/shared/routes'
import { defineAction } from '@/shared/server'

import { getNoteViewers, isVisibleForNote } from '../_lib/notes'

/**
 * Заметки: создать, изменить, удалить.
 *
 * ─────────────────────────────────────────────────────────────────
 * ОДИН НАБОР ДЕЙСТВИЙ НА ВСЕ ВИДЫ СОДЕРЖИМОГО
 *
 * Форма заметки одна и та же под разбором, уроком и записью эфира —
 * как и кнопка «Отложить». Три копии в трёх модулях разошлись бы
 * при первой правке.
 *
 * Прав не проверяем: заметка всегда своя. Идентификатор человека
 * берётся из сессии, а каждый запрос к базе ограничен им же — чужую
 * заметку нельзя ни прочитать, ни изменить, ни удалить, потому что
 * условие стоит в самом запросе, а не в отдельной сверке.
 *
 * При создании проверяем, что запись существует и видна: иначе заметки
 * накапливаются на идентификаторах, которых нет, а сама форма
 * превращается в способ узнать о чужом черновике.
 *
 * При правке и удалении такой проверки нет. Разбор могли снять
 * с публикации уже после того, как человек написал заметку, — запереть
 * её в этом случае значит оставить строку в базе навсегда.
 * ─────────────────────────────────────────────────────────────────
 */

const bodyInput = {
  body: z.string(),
  /** `null` — заметка про запись вообще, без привязки к моменту */
  timecodeSec: z.number().nullable(),
}

export const createNoteAction = defineAction({
  name: 'library.note.create',
  input: noteRefSchema.extend(bodyInput),
  handler: async ({ entityType, entityId, body, timecodeSec }) => {
    const viewers = await getNoteViewers()
    if (!viewers) throw errors.unauthorized()

    const ref = { entityType, entityId }

    if (!(await isVisibleForNote(viewers, ref))) {
      throw errors.notFound('Этого больше нет на платформе')
    }

    const note = await createNote({ userId: viewers.lesson.userId, ref, body, timecodeSec })

    revalidatePath(routes.app.me.notes())

    return note
  },
})

export const editNoteAction = defineAction({
  name: 'library.note.edit',
  input: z.object({ noteId: z.uuid(), ...bodyInput }),
  handler: async ({ noteId, body, timecodeSec }) => {
    const viewers = await getNoteViewers()
    if (!viewers) throw errors.unauthorized()

    const note = await editNote({ userId: viewers.lesson.userId, noteId, body, timecodeSec })

    revalidatePath(routes.app.me.notes())

    return note
  },
})

export const removeNoteAction = defineAction({
  name: 'library.note.remove',
  input: z.object({ noteId: z.uuid() }),
  handler: async ({ noteId }) => {
    const viewers = await getNoteViewers()
    if (!viewers) throw errors.unauthorized()

    await removeNote(viewers.lesson.userId, noteId)

    revalidatePath(routes.app.me.notes())

    return { removed: true }
  },
})
