import 'server-only'

import {
  findProgressFor,
  findProgressOne,
  findTouchedEntityTypes,
  upsertProgress,
} from './repository'
import { isCompleted, mergePercent, progressStatus, toPercent } from './rules'

import type { ProgressRow } from './repository'
import type { ProgressEntity } from './schema'

/**
 * Запись и чтение прогресса.
 *
 * Прав здесь не проверяем: прогресс всегда свой. Человек не может
 * записать прогресс другому — идентификатор берётся из сессии, а
 * не из запроса, и это единственная защита, которая тут нужна.
 */

export type ProgressView = {
  status: ReturnType<typeof progressStatus>
  percent: number
  positionSec: number
  completed: boolean
}

const EMPTY: ProgressView = {
  status: 'not_started',
  percent: 0,
  positionSec: 0,
  completed: false,
}

function toView(row: ProgressRow | null): ProgressView {
  if (!row) return EMPTY

  return {
    status: progressStatus(row),
    percent: row.percent,
    positionSec: row.positionSec,
    completed: isCompleted(row),
  }
}

/** Прогресс по набору объектов. Отсутствующие — «не начато» */
export async function getProgressMap(
  userId: string,
  entityType: ProgressEntity,
  entityIds: string[],
): Promise<Map<string, ProgressView>> {
  const rows = await findProgressFor(userId, entityType, entityIds)

  return new Map([...rows].map(([id, row]) => [id, toView(row)]))
}

export async function getProgress(
  userId: string,
  entityType: ProgressEntity,
  entityId: string,
): Promise<ProgressView> {
  return toView(await findProgressOne(userId, entityType, entityId))
}

/**
 * Отметка о просмотре от плеера.
 *
 * Приходит каждые несколько секунд, поэтому дешёвая и без побочных
 * действий. Доля просмотра только растёт: перемотка назад, чтобы
 * переслушать трудное место, не отменяет засчитанного.
 */
export async function recordPlayback(input: {
  userId: string
  entityType: ProgressEntity
  entityId: string
  positionSec: number
  durationSec: number | null
}): Promise<ProgressView> {
  const existing = await findProgressOne(input.userId, input.entityType, input.entityId)

  const percent = mergePercent(
    existing?.percent ?? 0,
    toPercent(input.positionSec, input.durationSec),
  )
  const completedManually = existing?.completedManually ?? false
  const snapshot = { percent, completedManually }

  await upsertProgress({
    userId: input.userId,
    entityType: input.entityType,
    entityId: input.entityId,
    // Положение, наоборот, всегда последнее: «продолжить» должно вернуть
    // человека туда, где он остановился, а не туда, где был максимум
    positionSec: Math.max(0, Math.round(input.positionSec)),
    percent,
    completedManually,
    completed: isCompleted(snapshot),
    now: new Date(),
  })

  return {
    status: progressStatus(snapshot),
    percent,
    positionSec: input.positionSec,
    completed: isCompleted(snapshot),
  }
}

/**
 * Отметка «пройдено» и её снятие вручную.
 *
 * Ручная отметка автоматикой не снимается — за это отвечает `isCompleted`.
 * Снять её может только сам человек этим же вызовом.
 */
export async function setCompleted(input: {
  userId: string
  entityType: ProgressEntity
  entityId: string
  completed: boolean
}): Promise<ProgressView> {
  const existing = await findProgressOne(input.userId, input.entityType, input.entityId)
  const snapshot = { percent: existing?.percent ?? 0, completedManually: input.completed }

  await upsertProgress({
    userId: input.userId,
    entityType: input.entityType,
    entityId: input.entityId,
    positionSec: existing?.positionSec ?? 0,
    percent: snapshot.percent,
    completedManually: input.completed,
    completed: isCompleted(snapshot),
    now: new Date(),
  })

  return {
    status: progressStatus(snapshot),
    percent: snapshot.percent,
    positionSec: existing?.positionSec ?? 0,
    completed: isCompleted(snapshot),
  }
}

/**
 * Что человек уже начинал: разборы, курс, эфиры.
 *
 * Отвечает на вопрос списка «Освойся в клубе» одним запросом.
 * Разбор считается открытым и по варианту, и по отдельной части: человек,
 * посмотревший только вступление, разбор уже открыл.
 */
export async function getStartedKinds(userId: string): Promise<{
  songs: boolean
  course: boolean
  streams: boolean
}> {
  const touched = await findTouchedEntityTypes(userId)

  return {
    songs: touched.has('arrangement') || touched.has('arrangement_section'),
    course: touched.has('lesson') || touched.has('course_module'),
    streams: touched.has('stream'),
  }
}
