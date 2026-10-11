import 'server-only'

import { findProfile } from '@/modules/identity'
import { ANONYMOUS_VIEWER } from '@/shared/content'
import type { ContentViewer } from '@/shared/content'
import { getLogger } from '@/shared/logger'
import type { SearchQuery } from '@/shared/search'

import {
  findCatalogFacets,
  findCatalogPage,
  findSearchSuggestions,
  findSimilarSongs,
  findSongBySlug,
  findArrangementsByIds,
  findSongsByIds,
  findStarterSongs,
} from './repository'
import { searchSongRows } from './search-repository'
import { starterAttempts } from './starter'

import type { CatalogFilters } from './catalog-filters'
import type { Level } from './domain'
import type { CatalogFacets } from './repository'
import type { SongHit } from './search-repository'
import type { CatalogPage, SimilarSong, SongCard, SongSuggestion, SongView } from './types'

/**
 * Разборы: что показывать и кому.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ «ВИДИТ ЛИ ЧЕРНОВИКИ» ПРИХОДИТ СВЕРХУ, А НЕ СЧИТАЕТСЯ ЗДЕСЬ
 *
 * До шага 5.3 сервис спрашивал права сам, вызовом `can`. Выглядело это
 * надёжнее — забыть невозможно, — но оказалось неверным: маска режима
 * «смотреть как участник» накладывается в слое приложения, и запрос
 * в обход неё возвращал настоящие права. Куратор, включивший режим,
 * продолжал видеть черновики — ровно то, ради предотвращения чего
 * режим и сделан.
 *
 * Теперь решение приезжает готовым, в `ContentViewer`. Опасность
 * «страница забудет проверить» закрыта иначе и надёжнее: собрать эту
 * структуру можно единственным способом — helper `getContentViewer`
 * в слое приложения, — а прямое обращение к правам оттуда запрещено
 * правилом линтера. Неверный вызов теперь не собирается, вместо того
 * чтобы тихо работать не так.
 * ─────────────────────────────────────────────────────────────────
 *
 * Проверки подписки в этом слое нет намеренно. Каталог и страница песни
 * открыты и тем, у кого подписка закончилась: они видят структуру,
 * описания и названия материалов, но не видео и не файлы. Закрывается
 * доступ к самому содержимому — при выдаче ссылки (модуль `media`).
 */

export async function getCatalogPage(
  viewer: ContentViewer,
  filters: CatalogFilters,
): Promise<CatalogPage> {
  return findCatalogPage({ ...filters, includeDrafts: viewer.canSeeDrafts })
}

/**
 * «Возможно, вы имели в виду» — когда не нашлось ничего.
 *
 * Отдельный вызов, а не часть выдачи каталога: он нужен на одном экране
 * из ста, и платить за него запросом при каждом удачном поиске незачем.
 */
export async function getSearchSuggestions(
  viewer: ContentViewer,
  query: string,
): Promise<SongSuggestion[]> {
  return findSearchSuggestions(query, viewer.canSeeDrafts)
}

/** Значения для фильтров: только те, что реально встречаются */
export async function getCatalogFacets(viewer: ContentViewer): Promise<CatalogFacets> {
  return findCatalogFacets(viewer.canSeeDrafts)
}

export async function getSongBySlug(viewer: ContentViewer, slug: string): Promise<SongView | null> {
  return findSongBySlug(slug, viewer.canSeeDrafts)
}

/**
 * Что открыть после этого разбора.
 *
 * Черновики в подборку не попадают даже куратору, и `ContentViewer`
 * здесь поэтому не нужен: подборка отвечает на вопрос участника
 * «что дальше», а не показывает состояние работы. Куратор, увидевший
 * в «похожих» собственный черновик, решит, что тот уже опубликован.
 */
export async function getSimilarSongs(songId: string, limit = 4): Promise<SimilarSong[]> {
  return findSimilarSongs(songId, false, limit)
}

/**
 * Уровень игры участника — чтобы открыть разбор ему по силам.
 *
 * Спрашивается у модуля участников, а не хранится в разборах: это
 * свойство человека, и дублировать его сюда значило бы однажды
 * разойтись с профилем.
 */
export async function getPreferredLevel(userId: string): Promise<Level | null> {
  return (await findProfile(userId))?.skillLevel ?? null
}

/**
 * Каталог для того, кто не вошёл.
 *
 * Понадобится публичной витрине, если она появится (PRD v0.1 §15,
 * вопрос 9). Отдельная функция, а не «viewer может быть пустым»:
 * необязательный параметр в проверке доступа — это способ однажды
 * случайно показать черновики тому, у кого прав нет вовсе.
 */
export async function getPublicCatalogPage(filters: CatalogFilters): Promise<CatalogPage> {
  return findCatalogPage({ ...filters, includeDrafts: ANONYMOUS_VIEWER.canSeeDrafts })
}

/**
 * Разборы по списку идентификаторов.
 *
 * Нужны там, где на разбор ссылается чужое содержимое: блок «связанный
 * разбор» в уроке курса хранит идентификатор, а не название — адрес
 * песни может поменяться, идентификатор нет.
 *
 * Разбор, снятый с публикации, в ответ не попадает. Ссылающийся на него
 * блок просто не показывается: это лучше, чем ссылка в никуда посреди
 * конспекта.
 */
export async function getSongsByIds(
  viewer: ContentViewer,
  ids: string[],
): Promise<{ id: string; slug: string; title: string; artist: string }[]> {
  return findSongsByIds(ids, viewer.canSeeDrafts)
}

/** Варианты разбора по идентификаторам — для кнопки «Продолжить» */
export async function getArrangementRefs(
  viewer: ContentViewer,
  ids: string[],
): Promise<{ id: string; level: string; songSlug: string; songTitle: string; artist: string }[]> {
  return findArrangementsByIds(ids, viewer.canSeeDrafts)
}

/**
 * Разборы, подходящие под запрос общей строки поиска (шаг 10.4).
 *
 * Черновики видит только тот, кому это позволено, — признак берётся
 * у читателя, а не решается здесь.
 */
export async function searchSongs(
  viewer: ContentViewer,
  query: SearchQuery,
  limit: number,
): Promise<SongHit[]> {
  return searchSongRows(query, viewer.canSeeDrafts, limit)
}

/**
 * Первый разбор для нового участника.
 *
 * Проходит лестницу попыток из `starter.ts` от точной к грубой и возвращает
 * первое найденное. Пусто — значит публиковать пока нечего; экран знакомства
 * в этом случае не показывается вовсе, а не выводит кнопку в никуда.
 *
 * Запросов делается столько, сколько попыток не сработало: в клубе
 * с двумястами разборами это почти всегда один. Останавливаться на первом
 * найденном важнее, чем экономить запрос: подбор случается один раз в жизни
 * участника.
 */
export async function getStarterSong(criteria: {
  level: Level | null
  genres: string[]
}): Promise<{ song: SongCard; reason: string } | null> {
  for (const attempt of starterAttempts(criteria)) {
    const [song] = await findStarterSongs({ level: attempt.level, genres: attempt.genres }, 1)

    if (song) {
      getLogger().debug({ reason: attempt.reason, songId: song.id }, 'подобран первый разбор')
      return { song, reason: attempt.reason }
    }
  }

  return null
}
