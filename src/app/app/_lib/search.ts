import 'server-only'

import { searchCurators } from '@/modules/club/service'
import { searchLessons } from '@/modules/course/service'
import { searchNews } from '@/modules/news/service'
import { searchSongs } from '@/modules/songs/service'
import { searchStreams } from '@/modules/streams/service'
import { appConfig } from '@/shared/config/app.config'
import type { ContentViewer } from '@/shared/content'
import { routes } from '@/shared/routes'
import { hasSearch, parseSearchQuery } from '@/shared/search'

import { getContentViewer } from './viewer'

/**
 * Общий поиск: одна строка на четыре раздела.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ РЕЗУЛЬТАТЫ НЕ СМЕШИВАЮТСЯ В ОДИН СПИСОК
 *
 * Соблазн был: собрать всё, отсортировать по рангу и показать общим
 * списком. Отказался.
 *
 * Ранги из четырёх разных запросов несопоставимы. `ts_rank_cd` считает
 * вес совпадения внутри своего вектора: у разбора вектор из четырёх
 * полей с весами, у эфира — из двух. Число 0,08 у песни и 0,08 у эфира
 * не означают одинаковой уместности, и общая сортировка по ним
 * выглядела бы случайной перетасовкой.
 *
 * Приводить их к общей шкале — это придумывать коэффициенты, которые
 * нечем обосновать и невозможно проверить. Группы по разделам честнее:
 * человек и так знает, ищет он песню или эфир.
 * ─────────────────────────────────────────────────────────────────
 *
 * Порядок групп постоянный — разборы, уроки, эфиры, кураторы, — а
 * не «где больше нашлось». Прыгающий порядок означает, что человек
 * каждый раз заново ищет глазами нужный раздел.
 */

export type SearchHit = {
  title: string
  subtitle: string
  href: string
}

export type SearchGroup = {
  key: 'songs' | 'lessons' | 'streams' | 'news' | 'curators'
  title: string
  hits: SearchHit[]
}

const GROUP_TITLES: Record<SearchGroup['key'], string> = {
  songs: 'Разборы',
  lessons: 'Уроки',
  streams: 'Эфиры',
  news: 'Новости',
  curators: 'Кураторы',
}

/**
 * Три читателя вместо одного: право видеть черновики в каждом разделе
 * своё. Куратор разборов не должен находить поиском черновики курса.
 */
async function getSearchViewers(): Promise<{
  songs: ContentViewer
  streams: ContentViewer
  course: ContentViewer
  news: ContentViewer
} | null> {
  const [songs, streams, course, news] = await Promise.all([
    getContentViewer('songs.view_drafts'),
    getContentViewer('streams.view_drafts'),
    getContentViewer('course.view_drafts'),
    getContentViewer('news.edit'),
  ])

  if (!songs || !streams || !course || !news) return null

  return { songs, streams, course, news }
}

/**
 * Найти всё по запросу.
 *
 * Пустые группы не возвращаются: заголовок «Эфиры» с пустотой под ним
 * заставляет читать четыре раздела вместо одного непустого.
 */
export async function findSearchGroups(rawQuery: string | null): Promise<SearchGroup[]> {
  const query = parseSearchQuery(rawQuery)
  if (!hasSearch(query)) return []

  const viewers = await getSearchViewers()
  if (!viewers) return []

  const limit = appConfig.search.perGroup

  const [songs, lessons, streams, news, curators] = await Promise.all([
    searchSongs(viewers.songs, query, limit),
    searchLessons(viewers.course, query, limit),
    searchStreams(viewers.streams, query, limit),
    // Новости ищет тот же читатель, что и эфиры: отдельного права
    // «видеть черновики новостей» в каталоге нет намеренно (шаг 10.7)
    searchNews(viewers.news, query, limit),
    searchCurators(query, limit),
  ])

  const groups: SearchGroup[] = [
    {
      key: 'songs',
      title: GROUP_TITLES.songs,
      hits: songs.map((item) => ({
        title: item.title,
        subtitle: item.artist,
        href: routes.app.learn.song(item.slug),
      })),
    },
    {
      key: 'lessons',
      title: GROUP_TITLES.lessons,
      hits: lessons.map((item) => ({
        title: item.title,
        subtitle: item.moduleTitle,
        href: routes.app.learn.lesson(item.moduleSlug, item.slug),
      })),
    },
    {
      key: 'streams',
      title: GROUP_TITLES.streams,
      hits: streams.map((item) => ({
        title: item.title,
        subtitle: formatStreamDate(item.startsAt),
        href: routes.app.streams.stream(item.slug),
      })),
    },
    {
      key: 'news',
      title: GROUP_TITLES.news,
      hits: news.map((item) => ({
        title: item.title,
        subtitle: item.publishedAt ? formatStreamDate(item.publishedAt) : '',
        href: routes.app.club.newsPost(item.slug),
      })),
    },
    {
      key: 'curators',
      title: GROUP_TITLES.curators,
      hits: curators.map((item) => ({
        title: item.displayName,
        subtitle: item.headline ?? '',
        href: routes.app.club.curator(item.slug),
      })),
    },
  ]

  return groups.filter((group) => group.hits.length > 0)
}

function formatStreamDate(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}
