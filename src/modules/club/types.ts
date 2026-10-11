/**
 * Что модуль клуба отдаёт наружу.
 *
 * Страницы получают готовое к показу: собранный стаж, отфильтрованные
 * пустые поля, имя и фотография участника рядом с карточкой. Собирать
 * человека из двух источников на стороне разметки — верный способ
 * получить три разных представления одного и того же куратора.
 */

/** Карточка в списке кураторов */
export type CuratorCard = {
  userId: string
  slug: string
  displayName: string
  avatarUrl: string | null
  headline: string | null
  city: string | null
  teaches: string[]
  /** Стаж преподавания в годах. `null` — год начала не указан */
  teachingYears: number | null
  isPublic: boolean
}

/** Страница куратора */
export type CuratorView = CuratorCard & {
  bio: string | null
  influences: string[]
  gear: string[]
  favoriteGenres: string[]
  socials: Record<string, string>
  /** Год начала преподавания — нужен редактору, а не показу */
  teachingSince: number | null
  orderIndex: number
}

/**
 * Содержимое куратора: что он вёл.
 *
 * Собирается слоем приложения из трёх модулей — разборов, эфиров
 * и курса. Модуль клуба про них не знает и знать не должен: иначе
 * «удалить раздел эфиров» перестало бы быть удалением одной папки.
 */
export type CuratorWork = {
  songCount: number
  streamCount: number
}

/**
 * Визитка участника в списке.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЧЕГО ЗДЕСЬ НЕТ И НЕ БУДЕТ
 *
 * Прогресса, статуса подписки, заметок, избранного, даты последнего
 * входа. Это личное и не становится общим оттого, что человек открыл
 * визитку: он согласился рассказать о себе, а не показать, сколько
 * уроков прошёл и платит ли он.
 *
 * Тип описан так, чтобы этих полей неоткуда было взять: в запросе
 * их нет, в типе их нет, показать их нельзя даже по ошибке.
 * ─────────────────────────────────────────────────────────────────
 */
export type MemberCard = {
  userId: string
  displayName: string
  avatarUrl: string | null
  city: string | null
  skillLevel: 'beginner' | 'intermediate' | 'advanced' | null
  /** Стаж игры в годах, посчитанный от года начала */
  playingYears: number | null
  /** Заполнен, если у человека есть показанная карточка куратора */
  curatorSlug: string | null
}

/** Страница визитки */
export type MemberView = MemberCard & {
  bio: string | null
  favoriteArtists: string[]
  favoriteGenres: string[]
  socials: Record<string, string>
}
