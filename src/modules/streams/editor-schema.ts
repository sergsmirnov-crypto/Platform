import { z } from 'zod'

/**
 * Что куратор может прислать редактору эфиров.
 *
 * Проверка живёт рядом с модулем, а не в форме: те же правила действуют,
 * откуда бы запись ни пришла — из браузера, из скрипта переноса
 * или из будущего мобильного приложения. Форма показывает ошибки,
 * но не решает, что верно.
 */

const TITLE_MAX = 160

const titleSchema = z
  .string()
  .trim()
  .min(3, 'Слишком короткая тема')
  .max(TITLE_MAX, `Не длиннее ${TITLE_MAX} символов`)

const descriptionSchema = z
  .string()
  .trim()
  .max(2000, 'Слишком длинное описание')
  .transform((value) => value || null)
  .nullable()

/**
 * Ссылка на трансляцию.
 *
 * Только `http` и `https`: остальные схемы адресов в браузере ведут
 * себя непредсказуемо, а эфиры проходят в Telegram или Zoom — обе
 * дают обычные ссылки.
 */
const joinUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === '' || /^https?:\/\//i.test(value), 'Ссылка должна начинаться с http')
  .transform((value) => value || null)
  .nullable()

export const streamInputSchema = z.object({
  title: titleSchema,
  description: descriptionSchema,

  /**
   * Время начала.
   *
   * Приходит уже датой: превращение «20:00 по Москве» в момент времени
   * делает форма через `fromClubInputValue`. Здесь остаётся проверка
   * здравого смысла — эфир не назначают на позапрошлый век
   */
  startsAt: z.coerce
    .date()
    .refine((value) => value.getFullYear() >= 2020, 'Проверьте дату')
    .refine((value) => value.getFullYear() <= 2100, 'Проверьте дату'),

  /** Кто ведёт. Пусто — эфир общий, без ведущего */
  curatorId: z.uuid().nullable(),

  joinUrl: joinUrlSchema,
})

export type StreamInput = z.infer<typeof streamInputSchema>

/**
 * Пункт оглавления.
 *
 * Секунда, а не строка «12:30»: разбор текста делает форма, сюда
 * приезжает уже число. Так одно и то же значение не разбирается
 * дважды по разным правилам.
 */
export const chapterInputSchema = z.object({
  title: z.string().trim().min(1, 'Название пункта не может быть пустым').max(200),
  startSec: z
    .number()
    .int()
    .min(0)
    .max(24 * 60 * 60),
})

/**
 * Оглавление целиком.
 *
 * Сохраняется списком, а не по пункту: куратор правит его как текст —
 * что-то дописал, что-то стёр, где-то поправил время, — и «сохранить
 * оглавление» для него одно действие.
 *
 * Сотни пунктов быть не может: полтора часа — это десяток тем.
 * Ограничение здесь не про производительность, а про защиту от того,
 * что прислали не оглавление.
 */
export const chaptersInputSchema = z.object({
  chapters: z.array(chapterInputSchema).max(100, 'Слишком много пунктов'),
})

/** Связь с разобранными песнями. Пустой список означает «связей нет» */
export const streamSongsInputSchema = z.object({
  songIds: z.array(z.uuid()).max(50),
})
