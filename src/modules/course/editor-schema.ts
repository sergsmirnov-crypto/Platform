import { z } from 'zod'

import { contentBlocksSchema } from '@/shared/blocks'

/**
 * Что куратор может прислать редактору курса.
 *
 * Проверка данных живёт рядом с модулем, а не в форме: те же правила
 * действуют, откуда бы запись ни пришла — из браузера, из скрипта
 * переноса или из будущего мобильного приложения. Форма показывает
 * ошибки, но не решает, что верно.
 */

/** Длина названия. Длиннее не помещается в строку карты курса */
const TITLE_MAX = 160

const titleSchema = z
  .string()
  .trim()
  .min(2, 'Слишком короткое название')
  .max(TITLE_MAX, `Не длиннее ${TITLE_MAX} символов`)

const descriptionSchema = z
  .string()
  .trim()
  .max(1000, 'Слишком длинное описание')
  .transform((value) => value || null)
  .nullable()

export const moduleInputSchema = z.object({
  title: titleSchema,
  description: descriptionSchema,
})

export type ModuleInput = z.infer<typeof moduleInputSchema>

export const lessonInputSchema = z.object({
  title: titleSchema,

  /** Строка «что освоишь» — показывается под названием на карте курса */
  summary: z
    .string()
    .trim()
    .max(300, 'Не длиннее 300 символов')
    .transform((value) => value || null)
    .nullable(),

  /**
   * Сколько примерно займёт урок.
   *
   * Необязательно, и пустое значение честнее выдуманного: карта курса
   * складывает эти числа в обещание «осталось около сорока минут»,
   * и одно выдуманное портит всю сумму.
   */
  estimatedMinutes: z
    .number()
    .int()
    .min(1, 'Не меньше минуты')
    .max(600, 'Не больше десяти часов')
    .nullable(),

  isFreePreview: z.boolean(),

  content: contentBlocksSchema,
})

export type LessonInput = z.infer<typeof lessonInputSchema>

/** Перестановка: список идентификаторов в новом порядке */
export const reorderSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(200),
})
