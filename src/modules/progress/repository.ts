import 'server-only'

import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'

import { db } from '@/shared/db'

import { progress } from './schema'

import type { ProgressEntity } from './schema'

export type ProgressRow = {
  entityType: ProgressEntity
  entityId: string
  positionSec: number
  percent: number
  completedManually: boolean
  completedAt: Date | null
  lastActivityAt: Date | null
}

/**
 * Прогресс человека по набору объектов одного вида.
 *
 * Одним запросом на всю страницу: карта курса из сорока уроков не может
 * позволить себе сорок обращений к базе. Отсутствующие в ответе объекты
 * означают «не начато» — отдельной строки для этого не заводится.
 */
export async function findProgressFor(
  userId: string,
  entityType: ProgressEntity,
  entityIds: string[],
): Promise<Map<string, ProgressRow>> {
  if (entityIds.length === 0) return new Map()

  const rows = await db
    .select({
      entityType: progress.entityType,
      entityId: progress.entityId,
      positionSec: progress.positionSec,
      percent: progress.percent,
      completedManually: progress.completedManually,
      completedAt: progress.completedAt,
      lastActivityAt: progress.lastActivityAt,
    })
    .from(progress)
    .where(
      and(
        eq(progress.userId, userId),
        eq(progress.entityType, entityType),
        inArray(progress.entityId, entityIds),
      ),
    )

  return new Map(rows.map((row) => [row.entityId, row]))
}

export async function findProgressOne(
  userId: string,
  entityType: ProgressEntity,
  entityId: string,
): Promise<ProgressRow | null> {
  const found = await findProgressFor(userId, entityType, [entityId])

  return found.get(entityId) ?? null
}

/**
 * Записывает прогресс.
 *
 * Одним запросом «вставить или обновить»: плеер шлёт положение каждые
 * несколько секунд, и пара «проверить, потом записать» на таком потоке
 * рано или поздно даёт две строки на один объект вместо одной.
 * Уникальный индекс это запрещает, и именно на него мы опираемся.
 */
export async function upsertProgress(input: {
  userId: string
  entityType: ProgressEntity
  entityId: string
  positionSec: number
  percent: number
  completedManually: boolean
  completed: boolean
  now: Date
}): Promise<void> {
  await db
    .insert(progress)
    .values({
      id: uuidv7(),
      userId: input.userId,
      entityType: input.entityType,
      entityId: input.entityId,
      positionSec: input.positionSec,
      percent: input.percent,
      completedManually: input.completedManually,
      status: input.completed ? 'completed' : 'in_progress',
      firstOpenedAt: input.now,
      lastActivityAt: input.now,
      completedAt: input.completed ? input.now : null,
    })
    .onConflictDoUpdate({
      target: [progress.userId, progress.entityType, progress.entityId],
      set: {
        positionSec: input.positionSec,
        percent: input.percent,
        completedManually: input.completedManually,
        status: input.completed ? 'completed' : 'in_progress',
        lastActivityAt: input.now,
        /*
         * Дата прохождения ставится один раз: она отвечает на вопрос
         * «когда человек это прошёл», а не «когда последний раз открывал».
         *
         * ⚠️ Именно `coalesce` на стороне базы, а не `??` в TypeScript.
         * Здесь `progress.completedAt` — не значение, а описание колонки,
         * и оно никогда не бывает пустым. Выражение `колонка ?? дата`
         * всегда возвращает колонку, то есть подставляет старое значение
         * поверх нового: строка, дошедшая до «пройдено» через обновление,
         * навсегда оставалась бы без даты.
         *
         * Ошибка не видна ни по коду, ни в типах, и проявляется только
         * на втором обращении к одной и той же записи.
         *
         * Время берём у базы (`now()`), а не привезённое из приложения:
         * так у всех строк один источник времени, и подставлять дату
         * параметром в это выражение не приходится.
         */
        completedAt: input.completed ? sql`coalesce(${progress.completedAt}, now())` : null,
        updatedAt: input.now,
      },
    })
}

/** Сколько объектов вида пройдено — для процента модуля и курса */
export async function countCompleted(
  userId: string,
  entityType: ProgressEntity,
  entityIds: string[],
): Promise<number> {
  const found = await findProgressFor(userId, entityType, entityIds)

  let completed = 0
  for (const row of found.values()) {
    if (row.completedManually || row.completedAt !== null) completed += 1
  }

  return completed
}

/**
 * Что человек трогал последним.
 *
 * Ради этого запроса прогресс и лежит в одной таблице на все виды
 * содержимого: главная кнопка платформы отвечает на вопрос без
 * объединения четырёх запросов.
 */
export async function findRecentActivity(userId: string, limit = 5): Promise<ProgressRow[]> {
  return db
    .select({
      entityType: progress.entityType,
      entityId: progress.entityId,
      positionSec: progress.positionSec,
      percent: progress.percent,
      completedManually: progress.completedManually,
      completedAt: progress.completedAt,
      lastActivityAt: progress.lastActivityAt,
    })
    .from(progress)
    .where(eq(progress.userId, userId))
    .orderBy(desc(progress.lastActivityAt))
    .limit(limit)
}

/**
 * Какие виды содержимого человек вообще трогал.
 *
 * Нужно списку «Освойся в клубе»: он спрашивает не «сколько пройдено»,
 * а «начинал ли вообще». Отдельный запрос, а не подсчёт по строкам
 * прогресса, потому что вопрос принципиально другой — тут достаточно
 * одной строки любого вида, и группировка отвечает на него, не вычитывая
 * весь прогресс участника.
 */
export async function findTouchedEntityTypes(userId: string): Promise<Set<ProgressEntity>> {
  const rows = await db
    .selectDistinct({ entityType: progress.entityType })
    .from(progress)
    .where(eq(progress.userId, userId))

  return new Set(rows.map((row) => row.entityType))
}
