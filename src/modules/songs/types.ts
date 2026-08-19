import type { MaterialView as MediaMaterialView } from '@/modules/media'
import type { PublicationStatus } from '@/shared/db/enums'

import type { Level } from './domain'

/**
 * Что модуль разборов отдаёт наружу.
 *
 * Типы описаны здесь, а не выводятся из таблиц. Причина: таблица —
 * это способ хранения, а не договор с интерфейсом. Выводя типы из схемы,
 * мы бы протащили в каждый компонент имена колонок и вынудили менять
 * разметку при любой перестановке в базе.
 *
 * Заметно это на строе: в базе лежит `e_standard`, участник видит
 * «E standard». Наружу уходит и то и другое — код фильтрует по первому,
 * человек читает второе.
 */

/** Карточка в каталоге. Ровно те поля, что нужны для отрисовки списка */
export type SongCard = {
  id: string
  slug: string
  title: string
  artist: string
  year: number | null
  coverUrl: string | null
  tuning: string | null
  tuningLabel: string | null
  /** Какие уровни разобраны — бейджи на карточке */
  levels: Level[]
  /** Сколько вариантов разбора всего */
  arrangementCount: number
  status: PublicationStatus
  publishedAt: Date | null
  /** Виден ли разбор обычному участнику. Черновики помечаются в каталоге */
  isPublic: boolean
}

/** Часть разбора со всем, что нужно для строки в списке и для плеера */
export type SectionView = {
  id: string
  title: string
  description: string | null
  orderIndex: number
  durationSec: number | null
  /** Что проигрывать. `null` — видео ещё не загружено */
  playback: { assetId: string; startSec: number; endSec: number | null } | null
}

/**
 * Материал разбора.
 *
 * Определён в модуле медиа: тот же список показывают урок курса
 * и запись эфира. Здесь оставлено имя, чтобы страницы разборов
 * не пришлось трогать.
 */
export type MaterialView = MediaMaterialView

/**
 * Подсказка «возможно, вы имели в виду».
 *
 * Намеренно беднее карточки каталога: это не результат поиска, а
 * предложение исправить запрос. Обложка и уровни здесь только отвлекали бы
 * от единственного действия — нажать и попробовать ещё раз.
 */
export type SongSuggestion = {
  slug: string
  title: string
  artist: string
}

/** Вариант разбора: уровень плюс всё его содержимое */
export type ArrangementView = {
  id: string
  level: Level
  title: string | null
  summary: string | null
  estimatedMinutes: number | null
  status: PublicationStatus
  isPublic: boolean
  curator: { id: string; displayName: string; avatarUrl: string | null } | null
  sections: SectionView[]
  materials: MaterialView[]
  /** Сумма длительностей частей, в секундах */
  totalDurationSec: number
}

/** Страница песни целиком */
export type SongView = {
  id: string
  slug: string
  title: string
  artist: string
  album: string | null
  year: number | null
  coverUrl: string | null
  description: string | null
  tuning: string | null
  tuningLabel: string | null
  capo: number | null
  tempoBpm: number | null
  musicKey: string | null
  status: PublicationStatus
  publishedAt: Date | null
  isPublic: boolean
  tags: TagView[]
  arrangements: ArrangementView[]
  materials: MaterialView[]
}

export type TagView = {
  id: string
  slug: string
  name: string
  kind: 'genre' | 'technique' | 'mood'
}

/**
 * Карточка в подборке «Похожие разборы».
 *
 * Это тот же `SongCard`: подборка отрисовывается теми же карточками,
 * что и каталог, и заводить для неё отдельный вид данных значило бы
 * поддерживать две почти одинаковых карточки, которые со временем
 * разойдутся.
 */
export type SimilarSong = SongCard

/** Страница каталога */
export type CatalogPage = {
  items: SongCard[]
  total: number
  page: number
  pageCount: number
}
