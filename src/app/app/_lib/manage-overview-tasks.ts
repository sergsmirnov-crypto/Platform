import { routes } from '@/shared/routes'
import { plural } from '@/shared/utils/plural'

/**
 * Из чего складывается экран «Обзор».
 *
 * Чистые функции, отделённые от обращений к базе: «показывать ли эту
 * заботу» — это правило, а правила в проекте проверяются тестами
 * (ARCHITECTURE §4). Ошибка здесь не роняет страницу, а делает хуже:
 * забота не показывается, и тихая поломка остаётся незамеченной именно
 * в том месте, которое заведено, чтобы её замечать.
 */

/** Одна забота: то, что стоит сделать сегодня */
export type OverviewTask = {
  id: string
  title: string
  hint: string
  href: string
  /** Насколько это срочно: влияет только на порядок и на метку */
  weight: 'high' | 'normal'
}

export type OverviewCounter = {
  label: string
  value: number
  href: string | null
}

/**
 * Ответы модулей. `null` означает «не спрашивали»: у человека нет права,
 * и отличать это от «спросили, ничего нет» обязательно — иначе куратору
 * без прав на курс покажут «всё в порядке» про курс, которого он
 * не видел.
 */
export type OverviewInput = {
  songs: {
    publishedRecently: number
    draftCount: number
    staleDrafts: { title: string; artist: string }[]
  } | null
  streams: { publishedRecently: number; missingRecordings: { title: string }[] } | null
  course: { draftModules: number; draftLessons: number; emptyModules: { title: string }[] } | null
  failedAssets: number | null
  subscriptions: { summary: { attention: number } } | null
}

export function buildOverviewTasks(input: OverviewInput): OverviewTask[] {
  const { songs, streams, course, failedAssets, subscriptions } = input

  const tasks: OverviewTask[] = []

  if (streams && streams.missingRecordings.length > 0) {
    tasks.push({
      id: 'streams.missing-recordings',
      title: `${streams.missingRecordings.length} ${plural(streams.missingRecordings.length, 'эфир ждёт', 'эфира ждут', 'эфиров ждут')} записи`,
      hint: listTitles(streams.missingRecordings.map((stream) => stream.title)),
      href: routes.app.manage.streams(),
      weight: 'high',
    })
  }

  if (course && course.emptyModules.length > 0) {
    tasks.push({
      id: 'course.empty-modules',
      title: `${course.emptyModules.length} ${plural(course.emptyModules.length, 'модуль курса открыт', 'модуля курса открыты', 'модулей курса открыты')} без уроков`,
      hint: listTitles(course.emptyModules.map((module) => module.title)),
      href: routes.app.manage.course(),
      weight: 'high',
    })
  }

  if (failedAssets && failedAssets > 0) {
    tasks.push({
      id: 'media.failed',
      title: `${failedAssets} ${plural(failedAssets, 'файл не загрузился', 'файла не загрузились', 'файлов не загрузились')}`,
      hint: 'Материал не доехал до хранилища. Участник видит пустое место там, где ждал таб или минусовку',
      href: routes.app.manage.media(),
      weight: 'high',
    })
  }

  if (subscriptions && subscriptions.summary.attention > 0) {
    tasks.push({
      id: 'subs.attention',
      title: `${subscriptions.summary.attention} ${plural(subscriptions.summary.attention, 'подписка требует', 'подписки требуют', 'подписок требуют')} внимания`,
      hint: 'Статус давно не сверялся или Telegram не отвечал. Обычно причина одна: перестал приходить вебхук',
      href: routes.app.manage.subscriptions(),
      weight: 'high',
    })
  }

  if (songs && songs.staleDrafts.length > 0) {
    tasks.push({
      id: 'songs.stale-drafts',
      title: `${songs.staleDrafts.length} ${plural(songs.staleDrafts.length, 'черновик разбора лежит', 'черновика разборов лежат', 'черновиков разборов лежат')} без движения`,
      hint: listTitles(songs.staleDrafts.map((song) => `${song.artist} — ${song.title}`)),
      href: `${routes.app.manage.songs()}?status=draft`,
      weight: 'normal',
    })
  }

  // Сначала тихие поломки, потом забытая работа: порядок задан здесь,
  // а не в разметке, — сортировать по смыслу должен тот, кто его знает
  return [...tasks].sort((a, b) => rank(b) - rank(a))
}

export function buildOverviewCounters(
  input: Pick<OverviewInput, 'songs' | 'streams' | 'course'>,
): OverviewCounter[] {
  const { songs, streams, course } = input

  const counters: OverviewCounter[] = []

  if (songs) {
    counters.push(
      {
        label: 'Разборов опубликовано за неделю',
        value: songs.publishedRecently,
        href: routes.app.manage.songs(),
      },
      {
        label: 'Разборов в черновиках',
        value: songs.draftCount,
        href: `${routes.app.manage.songs()}?status=draft`,
      },
    )
  }

  if (streams) {
    counters.push({
      label: 'Эфиров опубликовано за неделю',
      value: streams.publishedRecently,
      href: routes.app.manage.streams(),
    })
  }

  if (course) {
    counters.push({
      label: 'Уроков в черновиках',
      value: course.draftLessons + course.draftModules,
      href: routes.app.manage.course(),
    })
  }

  return counters
}

/** Первые несколько названий через запятую, остальные — числом */
function listTitles(titles: string[]): string {
  const shown = titles.slice(0, 2).join(', ')
  const rest = titles.length - 2

  return rest > 0 ? `${shown} и ещё ${rest}` : shown
}

function rank(task: OverviewTask): number {
  return task.weight === 'high' ? 1 : 0
}
