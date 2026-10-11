import { z } from 'zod'

/**
 * Что куратор может прислать в свою карточку.
 *
 * Списки — «чему учит», «на ком вырос», «инструменты» — приходят
 * массивом, а не строкой через запятую: разбор строки на стороне сервера
 * означал бы, что группа «Crosby, Stills & Nash» превращается в три
 * разных влияния.
 */

const shortList = z.array(z.string().trim().min(1).max(80)).max(20)

export const curatorCardSchema = z.object({
  headline: z
    .string()
    .trim()
    .max(120, 'Не длиннее 120 символов')
    .transform((value) => value || null)
    .nullable(),

  bio: z
    .string()
    .trim()
    .max(4000, 'Слишком длинный текст')
    .transform((value) => value || null)
    .nullable(),

  teaches: shortList,
  influences: shortList,
  gear: shortList,

  /**
   * Год начала преподавания.
   *
   * Год, а не «стаж в годах»: записанное число «двенадцать лет»
   * устаревает молча и через год врёт, а год начала не устаревает
   * никогда
   */
  teachingSince: z
    .number()
    .int()
    .min(1950, 'Проверьте год')
    .max(new Date().getFullYear(), 'Год в будущем')
    .nullable(),
})

export type CuratorCardInput = z.infer<typeof curatorCardSchema>
