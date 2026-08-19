import 'server-only'

import { requirePermission } from '@/modules/access'
import { errors } from '@/shared/errors'
import { slugify } from '@/shared/utils/slug'

import {
  deleteLessonRow,
  deleteModuleRow,
  findLessonOwner,
  findCourseOverview,
  findLessonsForEditor,
  findModulesForEditor,
  findModuleTitle,
  findOrCreateCourse,
  insertLesson,
  insertModule,
  lessonSlugTaken,
  moduleSlugTaken,
  nextLessonOrder,
  nextModuleOrder,
  reorderLessons,
  reorderModules,
  updateLesson,
  updateLessonStatus,
  updateLessonVideo,
  updateModule,
  updateModuleStatus,
} from './editor-repository'

import type { EditorLessonRow, EditorModuleRow } from './editor-repository'
import type { LessonInput, ModuleInput } from './editor-schema'

/**
 * Правила редактирования курса.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПРАВА КУРСА НЕ ИМЕЮТ ОБЛАСТИ «ТОЛЬКО СВОЁ»
 *
 * У разборов область есть: базовый куратор правит свои разборы
 * и не может испортить чужие. У курса её нет и не будет — курс один
 * на весь клуб, это общий материал, а не чья-то работа. Поэтому право
 * `course.edit` даёт правку всего курса целиком, и по пресетам ролей
 * (PRD v0.3) оно есть только у старшего куратора и выше.
 *
 * Отсюда следует: любой, кто дошёл до этого экрана, может править всё,
 * что на нём видит. Проверка сводится к наличию права.
 * ─────────────────────────────────────────────────────────────────
 */

export type CourseTree = {
  courseId: string
  modules: (EditorModuleRow & { lessons: EditorLessonRow[] })[]
}

/** Дерево модулей и уроков для экрана управления */
export async function getCourseTree(actorId: string): Promise<CourseTree> {
  await requirePermission(actorId, 'course.view_drafts')

  const courseId = await findOrCreateCourse(actorId)
  const [modules, lessons] = await Promise.all([
    findModulesForEditor(courseId),
    findLessonsForEditor(courseId),
  ])

  const byModule = new Map<string, EditorLessonRow[]>()

  for (const lesson of lessons) {
    const list = byModule.get(lesson.moduleId) ?? []
    list.push(lesson)
    byModule.set(lesson.moduleId, list)
  }

  return {
    courseId,
    modules: modules.map((module) => ({ ...module, lessons: byModule.get(module.id) ?? [] })),
  }
}

// ─────────────────────────────────────────────────────────────────
// МОДУЛИ
// ─────────────────────────────────────────────────────────────────

export async function createModule(actorId: string, values: ModuleInput): Promise<string> {
  await requirePermission(actorId, 'course.create')

  const courseId = await findOrCreateCourse(actorId)

  return insertModule({
    courseId,
    slug: await freeModuleSlug(courseId, values.title),
    values,
    orderIndex: await nextModuleOrder(courseId),
  })
}

export async function editModule(
  actorId: string,
  moduleId: string,
  values: ModuleInput,
): Promise<void> {
  await requirePermission(actorId, 'course.edit')

  // Адрес при переименовании не меняется намеренно: ссылка, отправленная
  // в чат клуба полгода назад, должна открываться и сегодня. Опечатка
  // в адресе — меньшее зло, чем битые ссылки у полутора сотен человек
  await updateModule(moduleId, values)
}

export async function setModulePublished(
  actorId: string,
  moduleId: string,
  published: boolean,
): Promise<void> {
  await requirePermission(actorId, 'course.publish')
  await updateModuleStatus(moduleId, published)
}

/**
 * Удаление модуля.
 *
 * Уроки внутри исчезают вместе с ним — это задано в схеме базы. Поэтому
 * пустой модуль удаляется свободно, а непустой требует подтверждения
 * на стороне интерфейса: здесь мы только сообщаем, сколько уроков
 * пропадёт.
 */
export async function removeModule(actorId: string, moduleId: string): Promise<void> {
  await requirePermission(actorId, 'course.delete')
  await deleteModuleRow(moduleId)
}

// ─────────────────────────────────────────────────────────────────
// УРОКИ
// ─────────────────────────────────────────────────────────────────

export async function createLesson(
  actorId: string,
  moduleId: string,
  values: LessonInput,
): Promise<string> {
  await requirePermission(actorId, 'course.create')

  return insertLesson({
    moduleId,
    slug: await freeLessonSlug(moduleId, values.title),
    values,
    orderIndex: await nextLessonOrder(moduleId),
  })
}

export async function editLesson(
  actorId: string,
  lessonId: string,
  values: LessonInput,
): Promise<void> {
  await requirePermission(actorId, 'course.edit')
  await updateLesson(lessonId, values)
}

/**
 * Публикация урока.
 *
 * Пустой урок опубликовать нельзя: ни видео, ни текста — значит,
 * участник откроет страницу с одним заголовком. Это единственная
 * проверка, и она про содержимое, а не про оформление.
 */
export async function setLessonPublished(
  actorId: string,
  lessonId: string,
  published: boolean,
  lesson: { hasVideo: boolean; blockCount: number },
): Promise<void> {
  await requirePermission(actorId, 'course.publish')

  if (published && !lesson.hasVideo && lesson.blockCount === 0) {
    throw errors.validation({
      content: 'Пустой урок публиковать нечего: добавьте видео или конспект',
    })
  }

  await updateLessonStatus(lessonId, published)
}

export async function setLessonVideo(
  actorId: string,
  lessonId: string,
  videoAssetId: string | null,
): Promise<void> {
  await requirePermission(actorId, 'course.edit')
  await updateLessonVideo(lessonId, videoAssetId)
}

export async function removeLesson(actorId: string, lessonId: string): Promise<void> {
  await requirePermission(actorId, 'course.delete')
  await deleteLessonRow(lessonId)
}

/** Где живёт урок — для проверок и сброса кэша страницы участника */
/**
 * Название модуля для журнала действий.
 *
 * Спрашивается ДО публикации или удаления: после удаления взять
 * название будет неоткуда, а запись «удалено из курса · 7f3a…»
 * не отвечает ни на один вопрос.
 */
export async function getModuleTitle(moduleId: string): Promise<string | null> {
  return findModuleTitle(moduleId)
}

export async function getLessonLocation(lessonId: string) {
  const location = await findLessonOwner(lessonId)
  if (!location) throw errors.notFound('Урок не найден')

  return location
}

// ─────────────────────────────────────────────────────────────────
// ПОРЯДОК
// ─────────────────────────────────────────────────────────────────

export async function reorderCourseModules(actorId: string, ids: string[]): Promise<void> {
  await requirePermission(actorId, 'course.reorder')
  await reorderModules(ids)
}

export async function reorderModuleLessons(actorId: string, ids: string[]): Promise<void> {
  await requirePermission(actorId, 'course.reorder')
  await reorderLessons(ids)
}

// ─────────────────────────────────────────────────────────────────
// АДРЕСА
// ─────────────────────────────────────────────────────────────────

/**
 * Свободный адрес.
 *
 * Название из одной кириллицы после перевода в латиницу может дать
 * пустую строку — тогда берём отметку времени. Некрасиво, но открывается;
 * пустой адрес не открывается вовсе.
 */
async function freeModuleSlug(courseId: string, title: string): Promise<string> {
  return uniqueSlug(title, (slug) => moduleSlugTaken(courseId, slug))
}

async function freeLessonSlug(moduleId: string, title: string): Promise<string> {
  return uniqueSlug(title, (slug) => lessonSlugTaken(moduleId, slug))
}

async function uniqueSlug(title: string, taken: (slug: string) => Promise<boolean>) {
  const base = slugify(title) || `item-${Date.now()}`

  if (!(await taken(base))) return base

  // Пробуем несколько раз, а не бесконечно: два урока с одинаковым
  // названием в одном модуле — обычное дело, двадцать — уже ошибка
  for (let suffix = 2; suffix <= 20; suffix += 1) {
    const candidate = `${base}-${suffix}`
    if (!(await taken(candidate))) return candidate
  }

  return `${base}-${Date.now()}`
}

/** Сводка по курсу для экрана «Обзор» (шаг 9.7) */
export async function getCourseOverview(actorId: string, limit: number) {
  await requirePermission(actorId, 'course.view_drafts')

  return findCourseOverview(limit)
}
