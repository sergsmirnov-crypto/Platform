import 'server-only'

import { isCompleted } from '@/modules/progress'
import { parseContentBlocks } from '@/shared/blocks'
import type { ContentViewer } from '@/shared/content'
import { errors } from '@/shared/errors'
import type { SearchQuery } from '@/shared/search'

import { findNeighbours, lessonNumber } from './outline'
import {
  findLessonBySlug,
  findLessons,
  findLessonsByIds,
  findModules,
  findPrimaryCourse,
} from './repository'
import { searchLessonRows } from './search-repository'

import type { LessonHit } from './search-repository'
import type { CourseMap, LessonPage, LessonView, ModuleListItem } from './types'

/**
 * Сборка курса для показа.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПРОГРЕСС ЗАБИРАЕТСЯ ОДНИМ ЗАПРОСОМ НА ВЕСЬ КУРС
 *
 * Курс из сорока уроков не может позволить себе сорок обращений
 * к базе за отметками «пройдено». Все идентификаторы уроков известны
 * сразу после выборки, поэтому прогресс берётся разом и раскладывается
 * по урокам в памяти.
 *
 * Это же объясняет, почему прогресс — отдельный модуль, а не колонка
 * в уроке: отметка принадлежит паре «человек и урок», а не уроку.
 *
 * Само соединение живёт в `repository.ts`: модулю курса разрешены
 * таблицы соседа, но не его сервис. Формула «что считать пройденным»
 * остаётся в модуле прогресса.
 * ─────────────────────────────────────────────────────────────────
 */

/** Карта курса: модули, уроки и отметки о прохождении */
export async function getCourseMap(viewer: ContentViewer): Promise<CourseMap | null> {
  const course = await findPrimaryCourse(viewer.canSeeDrafts)
  if (!course) return null

  const modules = await findModules(course.id, viewer.canSeeDrafts)
  const lessonRows = await findLessons(
    modules.map((module) => module.id),
    viewer.canSeeDrafts,
    viewer.userId,
  )

  const byModule = new Map<string, ModuleListItem['lessons']>()

  for (const lesson of lessonRows) {
    const list = byModule.get(lesson.moduleId) ?? []

    list.push({
      id: lesson.id,
      slug: lesson.slug,
      title: lesson.title,
      summary: lesson.summary,
      estimatedMinutes: lesson.estimatedMinutes,
      hasVideo: lesson.videoAssetId !== null,
      isFreePreview: lesson.isFreePreview,
      isDraft: lesson.status !== 'published',
      // Решение принимает модуль прогресса: «пройдено» — это ручная
      // отметка ИЛИ достаточная доля просмотра, и знать эту формулу
      // курсу незачем
      completed: isCompleted({
        percent: lesson.percent ?? 0,
        completedManually: lesson.completedManually ?? false,
      }),
    })

    byModule.set(lesson.moduleId, list)
  }

  return {
    ...course,
    modules: modules.map((module) => ({
      id: module.id,
      slug: module.slug,
      title: module.title,
      description: module.description,
      isDraft: module.status !== 'published',
      lessons: byModule.get(module.id) ?? [],
    })),
  }
}

/** Страница урока. Содержимое разбирается здесь, дальше идут только блоки */
export async function getLesson(
  viewer: ContentViewer,
  moduleSlug: string,
  lessonSlug: string,
): Promise<LessonView> {
  const row = await findLessonBySlug(moduleSlug, lessonSlug, viewer.canSeeDrafts)
  if (!row) throw errors.notFound('Урок не найден')

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    content: parseContentBlocks(row.content),
    videoAssetId: row.videoAssetId,
    estimatedMinutes: row.estimatedMinutes,
    isFreePreview: row.isFreePreview,
    isDraft: row.status !== 'published',
    module: { id: row.moduleId, slug: row.moduleSlug, title: row.moduleTitle },
    course: { id: row.courseId, slug: row.courseSlug, title: row.courseTitle },
  }
}

/**
 * Всё, что нужно странице урока, одним вызовом.
 *
 * Урок, его место в курсе, соседи для навигации, отметка о прохождении
 * и разборы, на которые он ссылается. Собирается здесь, а не на странице:
 * страница не должна знать, что «следующий урок» ищется по всему курсу,
 * а не внутри модуля.
 *
 * Карта курса запрашивается целиком — она нужна для соседей, номера
 * урока и отметки о прохождении сразу. При сорока уроках это один
 * недорогой запрос, а альтернатива — три отдельных запроса
 * «предыдущий», «следующий», «номер» — стоила бы дороже и врала бы
 * на границах модулей.
 *
 * Разборы, на которые ссылается урок, здесь не подставляются: они
 * принадлежат чужому модулю, и обращаться к нему напрямую модулю курса
 * запрещено. Их разрешает слой приложения — там же, где сходятся
 * материалы и права (см. страницу урока).
 */
export async function getLessonPage(
  viewer: ContentViewer,
  moduleSlug: string,
  lessonSlug: string,
): Promise<LessonPage> {
  const [lesson, map] = await Promise.all([
    getLesson(viewer, moduleSlug, lessonSlug),
    getCourseMap(viewer),
  ])

  const modules = map?.modules ?? []
  const all = modules.flatMap((module) => module.lessons)

  return {
    lesson,
    neighbours: findNeighbours(modules, lesson.id),
    number: lessonNumber(modules, lesson.id),
    totalLessons: all.length,
    // Отметка берётся из той же карты: прогресс уже приехал вместе
    // с ней одним запросом
    completed: all.find((item) => item.id === lesson.id)?.completed ?? false,
  }
}

/** Уроки по идентификаторам — для кнопки «Продолжить» и страницы прогресса */
export async function getLessonRefs(
  viewer: ContentViewer,
  ids: string[],
): Promise<
  { id: string; title: string; lessonSlug: string; moduleSlug: string; moduleTitle: string }[]
> {
  return findLessonsByIds(ids, viewer.canSeeDrafts)
}

/** Сколько уроков в курсе и сколько из них пройдено этим человеком */
export async function getCourseCompletion(
  viewer: ContentViewer,
): Promise<{ total: number; completed: number }> {
  const map = await getCourseMap(viewer)
  const lessons = map?.modules.flatMap((module) => module.lessons) ?? []

  return {
    total: lessons.length,
    completed: lessons.filter((lesson) => lesson.completed).length,
  }
}

/** Уроки, подходящие под запрос общей строки поиска (шаг 10.4) */
export async function searchLessons(
  viewer: ContentViewer,
  query: SearchQuery,
  limit: number,
): Promise<LessonHit[]> {
  return searchLessonRows(query, viewer.canSeeDrafts, limit)
}
