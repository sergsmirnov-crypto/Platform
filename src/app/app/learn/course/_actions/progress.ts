'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { getSession } from '@/modules/identity/current-user'
import { setCompleted } from '@/modules/progress/service'
import { errors } from '@/shared/errors'
import { routes } from '@/shared/routes'
import { defineAction } from '@/shared/server'

/**
 * Отметка «урок пройден».
 *
 * ─────────────────────────────────────────────────────────────────
 * ПРАВ ЗДЕСЬ НЕ ПРОВЕРЯЕМ, И ЭТО НЕ УПУЩЕНИЕ
 *
 * Прогресс всегда свой: идентификатор человека берётся из сессии,
 * а не из запроса. Отметить урок другому человеку невозможно, потому
 * что для этого пришлось бы прислать чужой идентификатор — а его никто
 * не спрашивает.
 *
 * Проверять при этом, существует ли урок, тоже незачем: строка прогресса
 * на несуществующий урок никому не видна, потому что чтение идёт через
 * соединение с самим уроком (ADR-0019).
 * ─────────────────────────────────────────────────────────────────
 */
export const markLessonAction = defineAction({
  name: 'course.lesson.complete',
  input: z.object({
    lessonId: z.uuid(),
    completed: z.boolean(),
    moduleSlug: z.string(),
    lessonSlug: z.string(),
  }),
  handler: async ({ lessonId, completed, moduleSlug, lessonSlug }) => {
    const session = await getSession()
    if (!session) throw errors.unauthorized()

    const result = await setCompleted({
      userId: session.user.id,
      entityType: 'lesson',
      entityId: lessonId,
      completed,
    })

    // Отметка видна в двух местах: на самом уроке и на карте курса,
    // где от неё зависят проценты, свёрнутость модуля и то, какой урок
    // подсвечен следующим
    revalidatePath(routes.app.learn.lesson(moduleSlug, lessonSlug))
    revalidatePath(routes.app.learn.course())

    return { completed: result.completed }
  },
})
