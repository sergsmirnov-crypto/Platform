import 'server-only'

import { getLessonRefs } from '@/modules/course/service'
import { groupNotes } from '@/modules/library'
import type { Note, NoteEntity, NoteRef } from '@/modules/library'
import { listNotes } from '@/modules/library/notes-service'
import { getArrangementRefs } from '@/modules/songs/service'
import { getStreamLinks } from '@/modules/streams/service'
import type { ContentViewer } from '@/shared/content'
import { routes } from '@/shared/routes'

import { getContentViewer } from './viewer'

/**
 * Заметки: превращение ссылок в то, на что можно нажать.
 *
 * Тот же приём, что у отложенного и у кнопки «Продолжить»: модуль знает
 * вид и идентификатор, а название записи и адрес спрашивает слой
 * приложения. Модули содержимого друг о друге по-прежнему не знают.
 *
 * Отличие от отложенного в одном: заметка привязана к **варианту
 * разбора**, а не к песне. Заметка про 2:14 относится к конкретной
 * записи, а у среднего уровня она другая, чем у начального.
 */

/** Читатели по разделам: право видеть черновики в каждом своё */
export type NoteViewers = Record<NoteEntity, ContentViewer>

export async function getNoteViewers(): Promise<NoteViewers | null> {
  const [arrangement, stream, lesson] = await Promise.all([
    getContentViewer('songs.view_drafts'),
    getContentViewer('streams.view_drafts'),
    getContentViewer('course.view_drafts'),
  ])

  if (!arrangement || !stream || !lesson) return null

  return { arrangement, stream, lesson }
}

/** Запись, к которой относится группа заметок */
export type NoteTarget = {
  entityType: NoteEntity
  entityId: string
  title: string
  subtitle: string
  href: string
}

export type NoteGroup = {
  target: NoteTarget
  notes: Note[]
}

/**
 * Все заметки человека, разложенные по записям.
 *
 * Группы идут в порядке последнего изменения: сверху то, что человек
 * трогал недавно. Внутри группы порядок обычный — по времени в ролике.
 *
 * Заметки к тому, чего больше нет или что скрыто от этого человека,
 * в ответ не попадают. Строки при этом остаются: разбор могут вернуть
 * из черновиков, и заметки должны вернуться вместе с ним.
 */
export async function findNoteGroups(viewers: NoteViewers): Promise<NoteGroup[]> {
  const userId = viewers.lesson.userId
  if (!userId) return []

  const notes = await listNotes(userId)
  if (notes.length === 0) return []

  const groups = groupNotes(notes)

  const idsOf = (entityType: NoteEntity) =>
    groups.filter((group) => group.ref.entityType === entityType).map((group) => group.ref.entityId)

  const [arrangements, streams, lessons] = await Promise.all([
    getArrangementRefs(viewers.arrangement, idsOf('arrangement')),
    getStreamLinks(viewers.stream, idsOf('stream')),
    getLessonRefs(viewers.lesson, idsOf('lesson')),
  ])

  const arrangementById = new Map(arrangements.map((item) => [item.id, item]))
  const streamById = new Map(streams.map((item) => [item.id, item]))
  const lessonById = new Map(lessons.map((item) => [item.id, item]))

  const result: NoteGroup[] = []

  for (const group of groups) {
    const target = toTarget(group.ref, arrangementById, streamById, lessonById)
    if (target) result.push({ target, notes: group.notes })
  }

  return result
}

function toTarget(
  ref: NoteRef,
  arrangements: Map<string, Awaited<ReturnType<typeof getArrangementRefs>>[number]>,
  streams: Map<string, Awaited<ReturnType<typeof getStreamLinks>>[number]>,
  lessons: Map<string, Awaited<ReturnType<typeof getLessonRefs>>[number]>,
): NoteTarget | null {
  const base = { entityType: ref.entityType, entityId: ref.entityId }

  switch (ref.entityType) {
    case 'arrangement': {
      const arrangement = arrangements.get(ref.entityId)
      if (!arrangement) return null

      return {
        ...base,
        title: arrangement.songTitle,
        subtitle: arrangement.artist,
        // Ссылка ведёт на тот самый вариант: заметка про 2:14 относится
        // к его записи, и открывать вместо неё другой уровень нельзя
        href: `${routes.app.learn.song(arrangement.songSlug)}?v=${arrangement.id}`,
      }
    }

    case 'stream': {
      const stream = streams.get(ref.entityId)
      if (!stream) return null

      return {
        ...base,
        title: stream.title,
        subtitle: stream.curatorName ?? '',
        href: routes.app.streams.stream(stream.slug),
      }
    }

    case 'lesson': {
      const lesson = lessons.get(ref.entityId)
      if (!lesson) return null

      return {
        ...base,
        title: lesson.title,
        subtitle: lesson.moduleTitle,
        href: routes.app.learn.lesson(lesson.moduleSlug, lesson.lessonSlug),
      }
    }
  }
}

/**
 * Адрес заметки: страница записи, открытая на нужной секунде.
 *
 * Параметр `t` уже понимают страницы разбора, урока и эфира — тот же,
 * которым кураторы отвечают в чате «смотри вот здесь».
 */
export function noteHref(target: NoteTarget, timecodeSec: number | null): string {
  if (timecodeSec === null) return target.href

  const separator = target.href.includes('?') ? '&' : '?'

  return `${target.href}${separator}t=${timecodeSec}`
}

/** Существует ли запись и видна ли она — проверка перед созданием заметки */
export async function isVisibleForNote(viewers: NoteViewers, ref: NoteRef): Promise<boolean> {
  switch (ref.entityType) {
    case 'arrangement':
      return (await getArrangementRefs(viewers.arrangement, [ref.entityId])).length > 0
    case 'stream':
      return (await getStreamLinks(viewers.stream, [ref.entityId])).length > 0
    case 'lesson':
      return (await getLessonRefs(viewers.lesson, [ref.entityId])).length > 0
  }
}
