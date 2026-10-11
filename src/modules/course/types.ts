import type { ContentBlocks } from '@/shared/blocks'

import type { LessonNeighbours } from './outline'

/**
 * Что модуль курса отдаёт наружу.
 *
 * Формы данных описаны здесь, а не выводятся из таблиц: страница урока
 * не должна ломаться от переименования колонки, а колонка не должна
 * попадать на страницу только потому, что она есть в таблице.
 */

/** Урок в карте курса: минимум, нужный для строки списка */
export type LessonListItem = {
  id: string
  slug: string
  title: string
  summary: string | null
  estimatedMinutes: number | null
  hasVideo: boolean
  isFreePreview: boolean
  isDraft: boolean
  /** Пройден этим человеком. У читателя без входа — всегда false */
  completed: boolean
}

/** Модуль в карте курса */
export type ModuleListItem = {
  id: string
  slug: string
  title: string
  description: string | null
  isDraft: boolean
  lessons: LessonListItem[]
}

/** Карта курса целиком — то, что показывает страница «Курс» */
export type CourseMap = {
  id: string
  slug: string
  title: string
  description: string | null
  modules: ModuleListItem[]
}

/** Страница одного урока */
export type LessonView = {
  id: string
  slug: string
  title: string
  summary: string | null
  content: ContentBlocks
  videoAssetId: string | null
  estimatedMinutes: number | null
  isFreePreview: boolean
  isDraft: boolean
  module: { id: string; slug: string; title: string }
  course: { id: string; slug: string; title: string }
}

/** Разбор, на который ссылается урок */
export type LinkedSong = {
  id: string
  slug: string
  title: string
  artist: string
}

/** Всё, что показывает страница урока */
export type LessonPage = {
  lesson: LessonView
  neighbours: LessonNeighbours
  /** Сквозной номер урока в курсе. `null` — урок вне карты (черновик) */
  number: number | null
  totalLessons: number
  completed: boolean
}
