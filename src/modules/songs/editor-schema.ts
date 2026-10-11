import { z } from 'zod'

import { LEVEL_VALUES } from './domain'

/**
 * Проверка того, что куратор ввёл в редакторе.
 *
 * ─────────────────────────────────────────────────────────────────
 * ГРАНИЦА ДОВЕРИЯ ПРОХОДИТ ЗДЕСЬ
 *
 * Всё, что приходит из браузера, — предположение, а не факт. Форма может
 * быть отправлена в обход интерфейса, поле — переименовано в отладчике,
 * число — прислано строкой. Поэтому ни одно действие сервера не принимает
 * данные, не пропустив их через схему отсюда (API.md).
 *
 * Схемы живут в модуле, а не рядом с формой: та же проверка нужна скрипту
 * переноса из Telegram, который формы не открывает вовсе.
 * ─────────────────────────────────────────────────────────────────
 *
 * Сообщения об ошибках написаны для куратора, а не для разработчика:
 * «Укажите название песни», а не «title: required». Их видит человек,
 * который в это время торопится опубликовать разбор.
 */

/** Пустая строка из формы означает «не заполнено», а не пустое значение */
const optionalText = z
  .string()
  .trim()
  .transform((value) => value || null)
  .nullable()

const requiredText = (message: string, max = 200) =>
  z.string().trim().min(1, message).max(max, `Слишком длинно: не больше ${max} символов`)

/**
 * Необязательное число из формы.
 *
 * Пустое поле браузер присылает пустой строкой, и это означает
 * «не заполнено», а не «ноль». Но всё остальное — уже введённое значение,
 * и ошибку в нём НЕЛЬЗЯ проглатывать: куратор, напечатавший год «2400»,
 * должен увидеть сообщение, а не обнаружить, что поле само опустело.
 *
 * Ровно на этом первая версия схемы и ошиблась: `.catch(null)` превращал
 * любое неверное значение в пустое, и опечатка исчезала бесследно.
 */
const optionalNumber = (schema: z.ZodType<number>) =>
  z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? null : value),
    schema.nullable(),
  )

/**
 * Поля песни.
 *
 * Обязательны только название и исполнитель. Строй, темп и тональность
 * куратор часто не знает наизусть и заполняет позже — требовать их
 * означало бы вынудить выдумывать, а выдуманные данные хуже отсутствующих:
 * по ним фильтруют.
 */
export const songInputSchema = z.object({
  title: requiredText('Укажите название песни'),
  artist: requiredText('Укажите исполнителя'),
  album: optionalText,
  year: optionalNumber(
    z
      .number()
      .int()
      .min(1900, 'Год выглядит слишком ранним')
      .max(new Date().getFullYear() + 1, 'Год ещё не наступил'),
  ),
  description: z.string().trim().max(4000, 'Описание слишком длинное').nullable(),
  tuning: optionalText,
  capo: optionalNumber(
    z.number().int().min(0).max(12, 'Каподастр выше двенадцатого лада не ставят'),
  ),
  tempoBpm: optionalNumber(z.number().int().min(20).max(300, 'Такой темп не сыграть')),
  musicKey: optionalText,
  tagIds: z.array(z.uuid()).max(20, 'Слишком много меток').default([]),
})

export type SongInput = z.infer<typeof songInputSchema>

/**
 * Поля варианта разбора.
 *
 * `curatorId` не входит: куратор варианта — это тот, кто его создал,
 * и переназначать автора может только старший куратор, отдельным действием.
 * Поле в общей форме однажды оказалось бы заполнено случайно.
 */
export const arrangementInputSchema = z.object({
  level: z.enum(LEVEL_VALUES),
  title: optionalText,
  summary: z.string().trim().max(2000, 'Слишком длинно').nullable(),
  estimatedMinutes: optionalNumber(
    z.number().int().min(1).max(600, 'Больше десяти часов — вероятно, опечатка'),
  ),
})

export type ArrangementInput = z.infer<typeof arrangementInputSchema>

/**
 * Часть разбора.
 *
 * Время начала и конца — в секундах от начала общего ролика. Куратор
 * вводит их как «2:14», превращение делает форма: хранить минуты
 * и секунды отдельными полями значило бы складывать их при каждом запросе.
 */
export const sectionInputSchema = z
  .object({
    id: z.uuid().optional(),
    title: requiredText('У части должно быть название', 120),
    description: z.string().trim().max(1000, 'Слишком длинно').nullable(),
    videoStartSec: optionalNumber(z.number().int().min(0)),
    videoEndSec: optionalNumber(z.number().int().min(0)),
  })
  .refine(
    (section) =>
      section.videoStartSec === null ||
      section.videoEndSec === null ||
      section.videoEndSec > section.videoStartSec,
    { message: 'Конец части раньше её начала', path: ['videoEndSec'] },
  )

export type SectionInput = z.infer<typeof sectionInputSchema>

/**
 * Порядок частей задаётся списком идентификаторов, а не полем «номер».
 *
 * Перетаскивание мышью — это новый порядок целиком, и присылать его
 * целиком честнее: при пересчёте номеров по одному два одновременных
 * перетаскивания дадут два элемента с номером «3».
 */
export const reorderSchema = z.object({
  arrangementId: z.uuid(),
  sectionIds: z.array(z.uuid()).min(1),
})
