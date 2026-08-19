import 'server-only'

import { appConfig } from '@/shared/config/app.config'
import { errors } from '@/shared/errors'

import {
  countNotes,
  deleteNote,
  findAllNotes,
  findNotesFor,
  insertNote,
  updateNote,
} from './notes-repository'
import { isNoteTooLong, isValidTimecode, normalizeNoteBody, sortNotes } from './notes-rules'
import { libraryStrings } from './strings'

import type { Note, NoteRef } from './types'

/**
 * Чтение и запись заметок.
 *
 * Прав здесь не проверяем: заметка всегда своя. Идентификатор человека
 * берётся из сессии, а не из запроса, и каждый запрос к базе ограничен
 * им же — включая правку и удаление.
 *
 * Существование самой записи, к которой привязана заметка, модуль
 * не проверяет: для этого нужно знать про разборы, курс и эфиры,
 * а ему о них знать нельзя. Проверка живёт в слое приложения — там же,
 * где и у избранного.
 */

/** Заметки к открытой записи, в порядке времени в ролике */
export async function getNotes(userId: string, ref: NoteRef): Promise<Note[]> {
  return sortNotes(await findNotesFor(userId, ref))
}

/** Все заметки человека, свежее сверху */
export async function listNotes(userId: string): Promise<Note[]> {
  return findAllNotes(userId, appConfig.library.maxNotes)
}

export async function getNoteCount(userId: string): Promise<number> {
  return countNotes(userId)
}

/**
 * Проверка текста и времени — одна на создание и на правку.
 *
 * Две копии этой проверки разошлись бы: правка позволила бы то, чего
 * не позволяет создание, и обнаружилось бы это через полгода на чужой
 * заметке в три тысячи знаков.
 */
function checkInput(body: string, timecodeSec: number | null): string {
  const text = normalizeNoteBody(body)
  if (!text) throw errors.validation({ body: libraryStrings.notes.errors.empty })

  if (isNoteTooLong(text, appConfig.library.maxNoteLength)) {
    throw errors.validation({ body: libraryStrings.notes.errors.tooLong })
  }

  if (!isValidTimecode(timecodeSec)) {
    throw errors.validation({ timecodeSec: libraryStrings.notes.errors.badTimecode })
  }

  return text
}

export async function createNote(input: {
  userId: string
  ref: NoteRef
  body: string
  timecodeSec: number | null
}): Promise<Note> {
  const body = checkInput(input.body, input.timecodeSec)

  const total = await countNotes(input.userId)
  if (total >= appConfig.library.maxNotes) {
    throw errors.conflict(libraryStrings.notes.errors.limitReached)
  }

  return insertNote({ ...input, body })
}

export async function editNote(input: {
  userId: string
  noteId: string
  body: string
  timecodeSec: number | null
}): Promise<Note> {
  const body = checkInput(input.body, input.timecodeSec)

  const updated = await updateNote({ ...input, body })

  // Чужая заметка и несуществующая дают один и тот же ответ: разница
  // сообщила бы, что заметка с таким идентификатором существует
  if (!updated) throw errors.notFound(libraryStrings.notes.errors.notFound)

  return updated
}

export async function removeNote(userId: string, noteId: string): Promise<void> {
  const deleted = await deleteNote(userId, noteId)

  if (!deleted) throw errors.notFound(libraryStrings.notes.errors.notFound)
}
