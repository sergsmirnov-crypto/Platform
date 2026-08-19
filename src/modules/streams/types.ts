import type { MaterialView } from '@/modules/media'

import type { StreamPhase } from './domain'

/**
 * Что модуль эфиров отдаёт наружу.
 *
 * Формы описаны здесь, а не выводятся из таблиц: страница не должна
 * ломаться от переименования колонки, а колонка не должна попадать
 * на страницу только потому, что она есть в таблице.
 */

/** Карточка в списке — и в ближайших, и в архиве */
export type StreamCard = {
  id: string
  slug: string
  title: string
  description: string | null
  startsAt: Date
  phase: StreamPhase
  curatorId: string | null
  curatorName: string | null
  coverUrl: string | null
  hasVideo: boolean
  durationSec: number | null
  isDraft: boolean
}

/** Пункт оглавления записи */
export type StreamChapter = {
  id: string
  title: string
  startSec: number
  /** Подпись «1:04:20» — считается один раз на сервере */
  timecode: string
}

/** Разобранная в эфире песня */
export type StreamSong = {
  id: string
  slug: string
  title: string
  artist: string
}

/** Страница эфира */
export type StreamView = StreamCard & {
  videoAssetId: string | null
  joinUrl: string | null
  canJoin: boolean
  chapters: StreamChapter[]
  songs: StreamSong[]
  /** Конспект, ссылки, разобранные табы — общая для платформы привязка */
  materials: MaterialView[]
  endedAt: Date | null
}

/**
 * Короткая справка об эфире.
 *
 * Нужна кнопке «Продолжить»: ей хватает названия и адреса, а тащить
 * ради строчки на главной всю карточку с обложкой и состоянием незачем.
 */
export type StreamRef = {
  id: string
  slug: string
  title: string
  curatorName: string | null
}
