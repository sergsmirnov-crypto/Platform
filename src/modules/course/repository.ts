import 'server-only'

import { and, asc, eq, inArray, sql } from 'drizzle-orm'

import { progress } from '@/modules/progress/schema'
import { db } from '@/shared/db'

import { courseModules, courses, lessons } from './schema'

/**
 * Запросы к базе — единственное место в модуле, где есть SQL.
 *
 * Черновики отсекаются здесь, а не в сервисе: условие видимости должно
 * быть частью запроса, иначе однажды кто-нибудь отфильтрует их уже
 * после выборки — и черновик успеет уехать в браузер вместе с ответом.
 */

/**
 * Что видно в списках.
 *
 * Куратор видит всё, участник — только опубликованное. Запланированное
 * к публикации в списки не попадает: время ещё не наступило.
 */
function listedOnly(includeDrafts: boolean) {
  return includeDrafts ? undefined : ('published' as const)
}

/**
 * Что открывается по прямой ссылке.
 *
 * Шире, чем списки: снятый с публикации урок остаётся доступен
 * по адресу. Иначе прогресс людей и ссылки, отправленные в чат клуба,
 * превращаются в «страница не найдена» в тот момент, когда куратор
 * решил перезаписать видео.
 */
const LINKABLE_STATUSES = ['published', 'archived'] as const

export type CourseRow = {
  id: string
  slug: string
  title: string
  description: string | null
}

/** Единственный курс клуба. Второй появится не раньше третьей версии */
export async function findPrimaryCourse(includeDrafts: boolean): Promise<CourseRow | null> {
  const [row] = await db
    .select({
      id: courses.id,
      slug: courses.slug,
      title: courses.title,
      description: courses.description,
    })
    .from(courses)
    .where(includeDrafts ? undefined : eq(courses.status, 'published'))
    .orderBy(asc(courses.orderIndex), asc(courses.createdAt))
    .limit(1)

  return row ?? null
}

export type ModuleRow = {
  id: string
  slug: string
  title: string
  description: string | null
  status: string
}

export async function findModules(courseId: string, includeDrafts: boolean): Promise<ModuleRow[]> {
  const listed = listedOnly(includeDrafts)

  return db
    .select({
      id: courseModules.id,
      slug: courseModules.slug,
      title: courseModules.title,
      description: courseModules.description,
      status: courseModules.status,
    })
    .from(courseModules)
    .where(
      and(
        eq(courseModules.courseId, courseId),
        listed ? eq(courseModules.status, listed) : undefined,
      ),
    )
    .orderBy(asc(courseModules.orderIndex))
}

export type LessonRow = {
  id: string
  moduleId: string
  slug: string
  title: string
  summary: string | null
  estimatedMinutes: number | null
  videoAssetId: string | null
  isFreePreview: boolean
  status: string
  /** Прогресс этого человека. `null` — урок не открывали */
  percent: number | null
  completedManually: boolean | null
}

/**
 * Уроки модулей вместе с отметками о прохождении.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ПРОГРЕСС ПРИСОЕДИНЯЕТСЯ ЗДЕСЬ, А НЕ ЗАПРАШИВАЕТСЯ ОТДЕЛЬНО
 *
 * Модулю курса запрещено обращаться к сервису модуля прогресса — это
 * проверяет линтер. Разрешено другое: таблицы соседа. База — общее
 * пространство, и связи по своей природе пересекают границы модулей
 * (ARCHITECTURE, «два задокументированных исключения»).
 *
 * Так получается один запрос вместо двух, а правило «что считать
 * пройденным» всё равно остаётся в модуле прогресса: сюда приезжают
 * только цифры, решение принимает `isCompleted`.
 * ─────────────────────────────────────────────────────────────────
 */
export async function findLessons(
  moduleIds: string[],
  includeDrafts: boolean,
  userId: string,
): Promise<LessonRow[]> {
  if (moduleIds.length === 0) return []

  const listed = listedOnly(includeDrafts)

  // У читателя без входа прогресса нет и быть не может: соединение
  // остаётся, но не совпадает ни с чем
  const forThisUser = userId ? eq(progress.userId, userId) : sql`false`

  return db
    .select({
      id: lessons.id,
      moduleId: lessons.moduleId,
      slug: lessons.slug,
      title: lessons.title,
      summary: lessons.summary,
      estimatedMinutes: lessons.estimatedMinutes,
      videoAssetId: lessons.videoAssetId,
      isFreePreview: lessons.isFreePreview,
      status: lessons.status,
      percent: progress.percent,
      completedManually: progress.completedManually,
    })
    .from(lessons)
    .leftJoin(
      progress,
      and(eq(progress.entityId, lessons.id), eq(progress.entityType, 'lesson'), forThisUser),
    )
    .where(
      and(inArray(lessons.moduleId, moduleIds), listed ? eq(lessons.status, listed) : undefined),
    )
    .orderBy(asc(lessons.orderIndex))
}

export type LessonDetailRow = Omit<LessonRow, 'percent' | 'completedManually'> & {
  content: unknown
  moduleSlug: string
  moduleTitle: string
  courseId: string
  courseSlug: string
  courseTitle: string
}

/**
 * Урок по адресу.
 *
 * Адрес урока уникален только внутри модуля, поэтому ищем по паре
 * «модуль + урок». Снятый с публикации урок открывается по прямой
 * ссылке — см. пояснение к условию видимости выше.
 */
export async function findLessonBySlug(
  moduleSlug: string,
  lessonSlug: string,
  includeDrafts: boolean,
): Promise<LessonDetailRow | null> {
  const [row] = await db
    .select({
      id: lessons.id,
      moduleId: lessons.moduleId,
      slug: lessons.slug,
      title: lessons.title,
      summary: lessons.summary,
      content: lessons.content,
      estimatedMinutes: lessons.estimatedMinutes,
      videoAssetId: lessons.videoAssetId,
      isFreePreview: lessons.isFreePreview,
      status: lessons.status,
      moduleSlug: courseModules.slug,
      moduleTitle: courseModules.title,
      courseId: courses.id,
      courseSlug: courses.slug,
      courseTitle: courses.title,
    })
    .from(lessons)
    .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
    .innerJoin(courses, eq(courses.id, courseModules.courseId))
    .where(
      and(
        eq(courseModules.slug, moduleSlug),
        eq(lessons.slug, lessonSlug),
        includeDrafts ? undefined : inArray(lessons.status, [...LINKABLE_STATUSES]),
      ),
    )
    .limit(1)

  return row ?? null
}

export type LessonRefRow = {
  id: string
  title: string
  lessonSlug: string
  moduleSlug: string
  moduleTitle: string
  status: string
}

/**
 * Уроки по списку идентификаторов.
 *
 * Нужны для кнопки «Продолжить»: прогресс хранит только идентификатор,
 * а показать надо название и путь к уроку. Снятые с публикации уроки
 * в ответ не попадают — продолжать то, чего участник больше не видит,
 * незачем.
 */
export async function findLessonsByIds(
  ids: string[],
  includeDrafts: boolean,
): Promise<LessonRefRow[]> {
  if (ids.length === 0) return []

  const listed = listedOnly(includeDrafts)

  return db
    .select({
      id: lessons.id,
      title: lessons.title,
      lessonSlug: lessons.slug,
      moduleSlug: courseModules.slug,
      moduleTitle: courseModules.title,
      status: lessons.status,
    })
    .from(lessons)
    .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
    .where(and(inArray(lessons.id, ids), listed ? eq(lessons.status, listed) : undefined))
}
