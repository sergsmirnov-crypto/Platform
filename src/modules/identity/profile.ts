import { z } from 'zod'

import { GENRE_NAMES } from '@/modules/taxonomy'

/**
 * Профиль участника: какие поля бывают и что считается допустимым.
 *
 * Здесь только чистые правила — ни базы, ни запроса. Поэтому проверка
 * данных покрыта тестами и работает одинаково на сервере и в форме.
 *
 * Правило проекта: **правила проверки живут в модуле, а не в форме.**
 * Проверка в браузере — удобство, она сообщает об ошибке до отправки.
 * Настоящая проверка всегда происходит на сервере: до него можно
 * достучаться и минуя форму.
 */

/** Сколько исполнителей помещается в профиль */
export const MAX_FAVORITE_ARTISTS = 12

/** Самый ранний год начала игры, который принимается всерьёз */
const EARLIEST_PLAYING_YEAR = 1930

/**
 * Жанры выбираются из списка, а не вводятся текстом.
 *
 * Свободный ввод дал бы «рок», «Рок», «rock» и «Рок-музыка» как четыре
 * разных жанра, и подбор материалов по жанру перестал бы работать
 * в тот же день. Исполнители, наоборот, вводятся свободно: список групп
 * бесконечен, и заранее его не составить.
 *
 * Сам список живёт в модуле меток: теми же жанрами размечаются разборы,
 * уроки и эфиры. Два списка в двух модулях разошлись бы при первом же
 * добавлении жанра, и «подбери разбор по моим вкусам» перестал бы
 * находить что-либо.
 */
export const GENRES = GENRE_NAMES

export type Genre = (typeof GENRES)[number]

/** Уровень игры. Совпадает со сложностью разборов — это одна и та же шкала */
export const SKILL_LEVELS = [
  { value: 'beginner', label: 'Начинающий' },
  { value: 'intermediate', label: 'Уверенный' },
  { value: 'advanced', label: 'Продвинутый' },
] as const

/**
 * Ссылки на себя.
 *
 * Список закрытый, а не «любая ссылка»: произвольные адреса в профиле
 * закрытого клуба — это способ размещать рекламу и уводить участников
 * на сторонние ресурсы. Telegram здесь нет намеренно: он и так известен
 * платформе из способа входа.
 */
export const SOCIAL_NETWORKS = [
  { key: 'vk', label: 'ВКонтакте', placeholder: 'https://vk.com/…' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@…' },
  { key: 'website', label: 'Сайт', placeholder: 'https://…' },
] as const

export type SocialKey = (typeof SOCIAL_NETWORKS)[number]['key']

/** Пустая строка из формы означает «не заполнено», а не пустое значение */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()

const socialUrl = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()
  .refine((value) => value === null || /^https:\/\/\S+\.\S+/.test(value), {
    message: 'Ссылка должна начинаться с https:// и вести на сайт',
  })

export const profileInputSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Имя должно быть хотя бы из двух букв')
    .max(60, 'Имя длиннее 60 символов не поместится в карточку'),

  city: optionalText(60, 'Название города длиннее 60 символов'),
  bio: optionalText(500, 'О себе — не длиннее 500 символов'),

  playingSince: z
    .number()
    .int()
    .min(EARLIEST_PLAYING_YEAR, 'Такой год выглядит опечаткой')
    .max(new Date().getFullYear(), 'Год начала игры не может быть в будущем')
    .nullable(),

  skillLevel: z.enum(['beginner', 'intermediate', 'advanced']).nullable(),

  favoriteArtists: z
    .array(z.string().trim().min(1).max(60))
    .max(MAX_FAVORITE_ARTISTS, `Не больше ${MAX_FAVORITE_ARTISTS} исполнителей`),

  favoriteGenres: z.array(z.enum(GENRES)),

  /**
   * Перечислены по одной, а не словарём: словарь с ключами из списка
   * требует, чтобы присутствовали все ключи сразу, и профиль без единой
   * ссылки перестал бы сохраняться
   */
  socials: z
    .object({
      vk: socialUrl.optional(),
      youtube: socialUrl.optional(),
      website: socialUrl.optional(),
    })
    .default({}),
})

export type ProfileInput = z.infer<typeof profileInputSchema>

/**
 * Профиль в том виде, в каком его показывает и правит страница.
 *
 * Лежит здесь, а не рядом с запросами к базе, по практической причине:
 * этот тип нужен форме, которая выполняется в браузере. Файл с запросами
 * тянет за собой серверный код, и импорт типа оттуда сломал бы сборку.
 */
export type UserProfile = {
  id: string
  displayName: string
  avatarUrl: string | null
  city: string | null
  bio: string | null
  playingSince: number | null
  skillLevel: 'beginner' | 'intermediate' | 'advanced' | null
  favoriteArtists: string[]
  favoriteGenres: string[]
  socials: Record<string, string>
}

/**
 * Приводит список исполнителей к порядку.
 *
 * Люди вводят их по-разному: через запятую, с лишними пробелами,
 * повторяя уже добавленное. Разбирать это в форме и на сервере отдельно
 * значит однажды получить разные результаты.
 */
export function normalizeArtists(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const raw of values) {
    for (const part of raw.split(',')) {
      const name = part.trim().replace(/\s+/g, ' ')
      if (!name) continue

      const key = name.toLowerCase()
      if (seen.has(key)) continue

      seen.add(key)
      result.push(name)

      if (result.length >= MAX_FAVORITE_ARTISTS) return result
    }
  }

  return result
}

/**
 * «Играю 5 лет» — с правильным окончанием.
 *
 * Русские числительные не выводятся из числа простым способом, а ошибка
 * («играю 3 лет») бросается в глаза сразу. Дешевле один раз описать
 * правило и закрыть его тестом.
 */
export function yearsPlayingLabel(
  playingSince: number | null,
  now: Date = new Date(),
): string | null {
  if (playingSince === null) return null

  const years = now.getFullYear() - playingSince
  if (years < 0) return null
  if (years === 0) return 'Играю меньше года'

  const lastTwo = years % 100
  const last = years % 10

  const word =
    lastTwo >= 11 && lastTwo <= 14
      ? 'лет'
      : last === 1
        ? 'год'
        : last >= 2 && last <= 4
          ? 'года'
          : 'лет'

  return `Играю ${years} ${word}`
}
