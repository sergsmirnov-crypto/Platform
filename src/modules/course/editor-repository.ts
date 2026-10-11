import 'server-only'

import { and, asc, eq, sql } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'

import { parseContentBlocks } from '@/shared/blocks'
import type { ContentBlocks } from '@/shared/blocks'
import { db } from '@/shared/db'

import { courseModules, courses, lessons } from './schema'

import type { LessonInput, ModuleInput } from './editor-schema'

/**
 * Запросы редактора курса.
 *
 * Отдельно от `repository.ts`, который читает курс для участника:
 * там всё отфильтровано по видимости и собрано для показа, здесь —
 * запись и чтение без оглядки на статус. Смешать их значило бы
 * однажды случайно применить фильтр видимости к правке.
 */

/** Единственный курс. Заводится сам при первом обращении куратора */
export async function findOrCreateCourse(createdBy: string): Promise<string> {
  const [existing] = await db
    .select({ id: courses.id })
    .from(courses)
    .orderBy(asc(courses.orderIndex))
    .limit(1)

  if (existing) return existing.id

  const id = uuidv7()

  await db.insert(courses).values({
    id,
    slug: 'course',
    title: 'Курс',
    status: 'draft',
    createdBy,
  })

  return id
}

export type EditorModuleRow = {
  id: string
  slug: string
  title: string
  description: string | null
  orderIndex: number
  status: string
}

export async function findModulesForEditor(courseId: string): Promise<EditorModuleRow[]> {
  return db
    .select({
      id: courseModules.id,
      slug: courseModules.slug,
      title: courseModules.title,
      description: courseModules.description,
      orderIndex: courseModules.orderIndex,
      status: courseModules.status,
    })
    .from(courseModules)
    .where(eq(courseModules.courseId, courseId))
    .orderBy(asc(courseModules.orderIndex))
}

export type EditorLessonRow = {
  id: string
  moduleId: string
  slug: string
  title: string
  summary: string | null
  estimatedMinutes: number | null
  isFreePreview: boolean
  orderIndex: number
  status: string
  hasVideo: boolean
  blockCount: number
  /** Разобранный конспект — форма правит его на месте, без второго запроса */
  content: ContentBlocks
}

export async function findLessonsForEditor(courseId: string): Promise<EditorLessonRow[]> {
  const rows = await db
    .select({
      id: lessons.id,
      moduleId: lessons.moduleId,
      slug: lessons.slug,
      title: lessons.title,
      summary: lessons.summary,
      estimatedMinutes: lessons.estimatedMinutes,
      isFreePreview: lessons.isFreePreview,
      orderIndex: lessons.orderIndex,
      status: lessons.status,
      videoAssetId: lessons.videoAssetId,
      content: lessons.content,
    })
    .from(lessons)
    .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
    .where(eq(courseModules.courseId, courseId))
    .orderBy(asc(lessons.orderIndex))

  return rows.map((row) => {
    // Разбираем здесь же: блок неизвестного вида не должен доехать
    // до редактора и потеряться при сохранении — он просто исчезнет
    // из списка, и это видно куратору сразу
    const content = parseContentBlocks(row.content)

    return {
      id: row.id,
      moduleId: row.moduleId,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      estimatedMinutes: row.estimatedMinutes,
      isFreePreview: row.isFreePreview,
      orderIndex: row.orderIndex,
      status: row.status,
      hasVideo: row.videoAssetId !== null,
      blockCount: content.length,
      content,
    }
  })
}

export async function insertModule(input: {
  courseId: string
  slug: string
  values: ModuleInput
  orderIndex: number
}): Promise<string> {
  const id = uuidv7()

  await db.insert(courseModules).values({
    id,
    courseId: input.courseId,
    slug: input.slug,
    title: input.values.title,
    description: input.values.description,
    orderIndex: input.orderIndex,
    status: 'draft',
  })

  return id
}

export async function updateModule(moduleId: string, values: ModuleInput): Promise<void> {
  await db
    .update(courseModules)
    .set({ title: values.title, description: values.description, updatedAt: new Date() })
    .where(eq(courseModules.id, moduleId))
}

export async function updateModuleStatus(moduleId: string, published: boolean): Promise<void> {
  await db
    .update(courseModules)
    .set({ status: published ? 'published' : 'draft', updatedAt: new Date() })
    .where(eq(courseModules.id, moduleId))
}

/** Название модуля — нужно журналу перед публикацией и удалением */
export async function findModuleTitle(moduleId: string): Promise<string | null> {
  const [row] = await db
    .select({ title: courseModules.title })
    .from(courseModules)
    .where(eq(courseModules.id, moduleId))
    .limit(1)

  return row?.title ?? null
}

export async function deleteModuleRow(moduleId: string): Promise<void> {
  await db.delete(courseModules).where(eq(courseModules.id, moduleId))
}

export async function insertLesson(input: {
  moduleId: string
  slug: string
  values: LessonInput
  orderIndex: number
}): Promise<string> {
  const id = uuidv7()

  await db.insert(lessons).values({
    id,
    moduleId: input.moduleId,
    slug: input.slug,
    title: input.values.title,
    summary: input.values.summary,
    estimatedMinutes: input.values.estimatedMinutes,
    isFreePreview: input.values.isFreePreview,
    content: input.values.content,
    orderIndex: input.orderIndex,
    status: 'draft',
  })

  return id
}

export async function updateLesson(lessonId: string, values: LessonInput): Promise<void> {
  await db
    .update(lessons)
    .set({
      title: values.title,
      summary: values.summary,
      estimatedMinutes: values.estimatedMinutes,
      isFreePreview: values.isFreePreview,
      content: values.content,
      updatedAt: new Date(),
    })
    .where(eq(lessons.id, lessonId))
}

export async function updateLessonContent(lessonId: string, content: ContentBlocks): Promise<void> {
  await db.update(lessons).set({ content, updatedAt: new Date() }).where(eq(lessons.id, lessonId))
}

export async function updateLessonStatus(lessonId: string, published: boolean): Promise<void> {
  await db
    .update(lessons)
    .set({
      status: published ? 'published' : 'draft',
      publishedAt: published ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(lessons.id, lessonId))
}

export async function updateLessonVideo(
  lessonId: string,
  videoAssetId: string | null,
): Promise<void> {
  await db
    .update(lessons)
    .set({ videoAssetId, updatedAt: new Date() })
    .where(eq(lessons.id, lessonId))
}

export async function deleteLessonRow(lessonId: string): Promise<void> {
  await db.delete(lessons).where(eq(lessons.id, lessonId))
}

/** Порядковые номера переписываются подряд — без дыр и повторов */
export async function reorderModules(ids: string[]): Promise<void> {
  await Promise.all(
    ids.map((id, index) =>
      db.update(courseModules).set({ orderIndex: index }).where(eq(courseModules.id, id)),
    ),
  )
}

export async function reorderLessons(ids: string[]): Promise<void> {
  await Promise.all(
    ids.map((id, index) => db.update(lessons).set({ orderIndex: index }).where(eq(lessons.id, id))),
  )
}

/** Следующий порядковый номер в конце списка */
export async function nextModuleOrder(courseId: string): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`coalesce(max(${courseModules.orderIndex}), -1) + 1` })
    .from(courseModules)
    .where(eq(courseModules.courseId, courseId))

  return row?.value ?? 0
}

export async function nextLessonOrder(moduleId: string): Promise<number> {
  const [row] = await db
    .select({ value: sql<number>`coalesce(max(${lessons.orderIndex}), -1) + 1` })
    .from(lessons)
    .where(eq(lessons.moduleId, moduleId))

  return row?.value ?? 0
}

/**
 * Занят ли адрес.
 *
 * Адреса уникальны внутри родителя, а не глобально: «основы» может быть
 * и в первом модуле, и во втором. Поэтому проверка всегда идёт в паре
 * с идентификатором родителя.
 */
export async function moduleSlugTaken(courseId: string, slug: string): Promise<boolean> {
  const [row] = await db
    .select({ id: courseModules.id })
    .from(courseModules)
    .where(and(eq(courseModules.courseId, courseId), eq(courseModules.slug, slug)))
    .limit(1)

  return row !== undefined
}

export async function lessonSlugTaken(moduleId: string, slug: string): Promise<boolean> {
  const [row] = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(and(eq(lessons.moduleId, moduleId), eq(lessons.slug, slug)))
    .limit(1)

  return row !== undefined
}

/** Модуль урока — нужен для проверки прав и для сброса кэша страницы */
/**
 * Где лежит урок и как он называется.
 *
 * Название приходит тем же запросом, что и расположение: оно нужно
 * журналу действий при удалении урока, а после удаления взять его
 * будет неоткуда.
 */
export async function findLessonOwner(lessonId: string): Promise<{
  moduleId: string
  moduleSlug: string
  lessonSlug: string
  lessonTitle: string
  moduleTitle: string
} | null> {
  const [row] = await db
    .select({
      moduleId: lessons.moduleId,
      moduleSlug: courseModules.slug,
      lessonSlug: lessons.slug,
      lessonTitle: lessons.title,
      moduleTitle: courseModules.title,
    })
    .from(lessons)
    .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
    .where(eq(lessons.id, lessonId))
    .limit(1)

  return row ?? null
}

// ─────────────────────────────────────────────────────────────────
// СВОДКА ДЛЯ ЭКРАНА «ОБЗОР» (шаг 9.7)
// ─────────────────────────────────────────────────────────────────

export type CourseOverviewRow = {
  draftModules: number
  draftLessons: number
  /** Опубликованные модули, в которых нет ни одного опубликованного урока */
  emptyModules: { id: string; title: string }[]
}

/**
 * Сводка по курсу.
 *
 * Пустой опубликованный модуль — тихая поломка: в карте курса он виден,
 * участник по нему нажимает и попадает в никуда. Сам о себе такой модуль
 * не сообщит, поэтому его место здесь.
 */
export async function findCourseOverview(limit: number): Promise<CourseOverviewRow> {
  const [counts, empty] = await Promise.all([
    db
      .select({
        draftModules: sql<number>`(
          select count(*) from ${courseModules} where ${courseModules.status} = 'draft'
        )::int`,
        draftLessons: sql<number>`(
          select count(*) from ${lessons} where ${lessons.status} = 'draft'
        )::int`,
      })
      .from(sql`(select 1) as one`),

    db
      .select({ id: courseModules.id, title: courseModules.title })
      .from(courseModules)
      .where(
        and(
          eq(courseModules.status, 'published'),
          sql`not exists (
            select 1 from ${lessons}
            where ${lessons.moduleId} = ${courseModules.id} and ${lessons.status} = 'published'
          )`,
        ),
      )
      .orderBy(asc(courseModules.orderIndex))
      .limit(limit),
  ])

  return {
    draftModules: counts[0]?.draftModules ?? 0,
    draftLessons: counts[0]?.draftLessons ?? 0,
    emptyModules: empty,
  }
}
