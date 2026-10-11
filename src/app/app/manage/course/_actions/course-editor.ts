'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { AUDIT_ACTIONS, recordAudit } from '@/modules/audit'
import { lessonInputSchema, moduleInputSchema, reorderSchema } from '@/modules/course'
import {
  createLesson,
  createModule,
  editLesson,
  editModule,
  getLessonLocation,
  getModuleTitle,
  removeLesson,
  removeModule,
  reorderCourseModules,
  reorderModuleLessons,
  setLessonPublished,
  setLessonVideo,
  setModulePublished,
} from '@/modules/course/editor-service'
import { getSession } from '@/modules/identity/current-user'
import { linkExternalVideo } from '@/modules/media/service'
import { errors } from '@/shared/errors'
import { routes } from '@/shared/routes'
import { defineAction } from '@/shared/server'

/**
 * Точки входа редактора курса.
 *
 * Здесь — «кто это и что он прислал»; в модуле — «что при этом можно
 * и по каким правилам». То же разделение, что у редактора разборов
 * (см. пояснение в `manage/songs/_actions/song-editor.ts`).
 */

async function actor(): Promise<string> {
  const session = await getSession()
  if (!session) throw errors.unauthorized()

  return session.user.id
}

/**
 * Сброс кэша.
 *
 * Курс виден в трёх местах: в управлении, на карте курса у участника
 * и на странице конкретного урока. Обновлять только редактор — значит
 * показывать куратору свежее там, где он правил, и вчерашнее там, куда
 * он пойдёт проверять результат.
 */
function revalidateCourse(lesson?: { moduleSlug: string; lessonSlug: string }): void {
  revalidatePath(routes.app.manage.course())
  revalidatePath(routes.app.learn.course())

  if (lesson) revalidatePath(routes.app.learn.lesson(lesson.moduleSlug, lesson.lessonSlug))
}

// ─────────────────────────────────────────────────────────────────
// МОДУЛИ
// ─────────────────────────────────────────────────────────────────

export const createModuleAction = defineAction({
  name: 'course.module.create',
  input: moduleInputSchema,
  handler: async (values) => {
    const id = await createModule(await actor(), values)
    revalidateCourse()

    return { id }
  },
})

export const editModuleAction = defineAction({
  name: 'course.module.edit',
  input: z.object({ moduleId: z.uuid(), values: moduleInputSchema }),
  handler: async ({ moduleId, values }) => {
    await editModule(await actor(), moduleId, values)
    revalidateCourse()

    return { saved: true }
  },
})

export const setModulePublishedAction = defineAction({
  name: 'course.module.publish',
  input: z.object({ moduleId: z.uuid(), published: z.boolean() }),
  handler: async ({ moduleId, published }) => {
    const actorId = await actor()
    const title = await getModuleTitle(moduleId)

    await setModulePublished(actorId, moduleId, published)
    await recordAudit({
      actorId,
      action: published ? AUDIT_ACTIONS.coursePublish : AUDIT_ACTIONS.courseUnpublish,
      entityType: 'course_module',
      entityId: moduleId,
      entityTitle: title,
    })

    revalidateCourse()

    return { published }
  },
})

export const deleteModuleAction = defineAction({
  name: 'course.module.delete',
  input: z.object({ moduleId: z.uuid() }),
  handler: async ({ moduleId }) => {
    const actorId = await actor()

    // Название спрашиваем до удаления: после него спрашивать будет
    // не у кого, а «удалено из курса · 7f3a…» не отвечает ни на один вопрос
    const title = await getModuleTitle(moduleId)

    await removeModule(actorId, moduleId)
    await recordAudit({
      actorId,
      action: AUDIT_ACTIONS.courseDelete,
      entityType: 'course_module',
      entityId: moduleId,
      entityTitle: title,
    })

    revalidateCourse()

    return { deleted: true }
  },
})

export const reorderModulesAction = defineAction({
  name: 'course.module.reorder',
  input: reorderSchema,
  handler: async ({ ids }) => {
    await reorderCourseModules(await actor(), ids)
    revalidateCourse()

    return { reordered: true }
  },
})

// ─────────────────────────────────────────────────────────────────
// УРОКИ
// ─────────────────────────────────────────────────────────────────

export const createLessonAction = defineAction({
  name: 'course.lesson.create',
  input: z.object({ moduleId: z.uuid(), values: lessonInputSchema }),
  handler: async ({ moduleId, values }) => {
    const id = await createLesson(await actor(), moduleId, values)
    revalidateCourse()

    return { id }
  },
})

export const editLessonAction = defineAction({
  name: 'course.lesson.edit',
  input: z.object({ lessonId: z.uuid(), values: lessonInputSchema }),
  handler: async ({ lessonId, values }) => {
    await editLesson(await actor(), lessonId, values)
    revalidateCourse(await getLessonLocation(lessonId))

    return { saved: true }
  },
})

export const setLessonPublishedAction = defineAction({
  name: 'course.lesson.publish',
  input: z.object({
    lessonId: z.uuid(),
    published: z.boolean(),
    // Состояние урока присылает интерфейс — он его только что показывал.
    // Проверку «пустой урок публиковать нечего» это не ослабляет:
    // соврать можно только себе, опубликовав собственный пустой урок
    hasVideo: z.boolean(),
    blockCount: z.number().int().min(0),
  }),
  handler: async ({ lessonId, published, hasVideo, blockCount }) => {
    const actorId = await actor()
    const location = await getLessonLocation(lessonId)

    await setLessonPublished(actorId, lessonId, published, { hasVideo, blockCount })
    await recordAudit({
      actorId,
      action: published ? AUDIT_ACTIONS.coursePublish : AUDIT_ACTIONS.courseUnpublish,
      entityType: 'lesson',
      entityId: lessonId,
      entityTitle: lessonLabel(location),
    })

    revalidateCourse(location)

    return { published }
  },
})

/**
 * Привязка ролика к уроку.
 *
 * Идентификатор из панели видеохостинга, как и у разборов: часовое
 * видео через наш сервер не идёт и идти не должно (ADR-0016).
 */
export const attachLessonVideoAction = defineAction({
  name: 'course.lesson.video',
  input: z.object({
    lessonId: z.uuid(),
    externalId: z.string().trim().min(1).max(200).nullable(),
  }),
  handler: async ({ lessonId, externalId }) => {
    const actorId = await actor()

    const assetId = externalId ? await linkExternalVideo(externalId, actorId, null) : null

    await setLessonVideo(actorId, lessonId, assetId)
    revalidateCourse(await getLessonLocation(lessonId))

    return { assetId }
  },
})

export const deleteLessonAction = defineAction({
  name: 'course.lesson.delete',
  input: z.object({ lessonId: z.uuid() }),
  handler: async ({ lessonId }) => {
    const actorId = await actor()
    const location = await getLessonLocation(lessonId)

    await removeLesson(actorId, lessonId)
    await recordAudit({
      actorId,
      action: AUDIT_ACTIONS.courseDelete,
      entityType: 'lesson',
      entityId: lessonId,
      entityTitle: lessonLabel(location),
    })

    revalidateCourse(location)

    return { deleted: true }
  },
})

export const reorderLessonsAction = defineAction({
  name: 'course.lesson.reorder',
  input: reorderSchema,
  handler: async ({ ids }) => {
    await reorderModuleLessons(await actor(), ids)
    revalidateCourse()

    return { reordered: true }
  },
})

/**
 * Как урок называется в журнале действий.
 *
 * С названием модуля: в курсе легко встретить два «Вступления»,
 * и запись «удалено из курса · Вступление» без модуля не помогает.
 */
function lessonLabel(location: { moduleTitle: string; lessonTitle: string }): string {
  return `${location.moduleTitle} · ${location.lessonTitle}`
}
