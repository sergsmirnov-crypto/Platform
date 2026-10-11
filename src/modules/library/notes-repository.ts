import 'server-only'

import { and, count, desc, eq } from 'drizzle-orm'

import { db } from '@/shared/db'

import { userNotes } from './schema'

import type { Note, NoteRef } from './types'

/**
 * Запросы заметок.
 *
 * ⚠️ **Каждый запрос ограничен `user_id`, включая правку и удаление.**
 * Не «сначала загрузим и сверим владельца», а условие прямо в запросе:
 * забытая сверка не видна ни в коде, ни в типах, а стоит чужой заметки.
 */

const FIELDS = {
  id: userNotes.id,
  entityType: userNotes.entityType,
  entityId: userNotes.entityId,
  body: userNotes.body,
  timecodeSec: userNotes.timecodeSec,
  createdAt: userNotes.createdAt,
  updatedAt: userNotes.updatedAt,
}

/** Заметки к открытой записи */
export async function findNotesFor(userId: string, ref: NoteRef): Promise<Note[]> {
  return db
    .select(FIELDS)
    .from(userNotes)
    .where(
      and(
        eq(userNotes.userId, userId),
        eq(userNotes.entityType, ref.entityType),
        eq(userNotes.entityId, ref.entityId),
      ),
    )
}

/** Все заметки человека, свежее сверху — для страницы «Мои заметки» */
export async function findAllNotes(userId: string, limit: number): Promise<Note[]> {
  return db
    .select(FIELDS)
    .from(userNotes)
    .where(eq(userNotes.userId, userId))
    .orderBy(desc(userNotes.updatedAt))
    .limit(limit)
}

export async function countNotes(userId: string): Promise<number> {
  const [result] = await db
    .select({ total: count() })
    .from(userNotes)
    .where(eq(userNotes.userId, userId))

  return result?.total ?? 0
}

export async function insertNote(input: {
  userId: string
  ref: NoteRef
  body: string
  timecodeSec: number | null
}): Promise<Note> {
  const [row] = await db
    .insert(userNotes)
    .values({
      userId: input.userId,
      entityType: input.ref.entityType,
      entityId: input.ref.entityId,
      body: input.body,
      timecodeSec: input.timecodeSec,
    })
    .returning(FIELDS)

  // Вставка без строки в ответе означает поломку драйвера, а не пустой
  // результат: обрабатывать это как «не найдено» было бы враньём
  if (!row) throw new Error('Заметка не сохранилась')

  return row
}

/**
 * Правка. Возвращает `null`, если заметки нет **или она чужая** —
 * снаружи эти случаи неразличимы намеренно.
 */
export async function updateNote(input: {
  userId: string
  noteId: string
  body: string
  timecodeSec: number | null
}): Promise<Note | null> {
  const [row] = await db
    .update(userNotes)
    .set({ body: input.body, timecodeSec: input.timecodeSec, updatedAt: new Date() })
    .where(and(eq(userNotes.id, input.noteId), eq(userNotes.userId, input.userId)))
    .returning(FIELDS)

  return row ?? null
}

/** Удаление. `false`, если заметки нет или она чужая */
export async function deleteNote(userId: string, noteId: string): Promise<boolean> {
  const rows = await db
    .delete(userNotes)
    .where(and(eq(userNotes.id, noteId), eq(userNotes.userId, userId)))
    .returning({ id: userNotes.id })

  return rows.length > 0
}
