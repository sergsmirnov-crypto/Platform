import 'server-only'

import { findNextLesson } from '@/modules/course'
import { getCourseMap, getLessonRefs } from '@/modules/course/service'
import { isCompleted } from '@/modules/progress'
import { findRecentActivity } from '@/modules/progress/repository'
import { getArrangementRefs } from '@/modules/songs/service'
import { getStreamRefs } from '@/modules/streams/service'
import type { ContentViewer } from '@/shared/content'
import { routes } from '@/shared/routes'

/**
 * «Продолжить»: превращение прогресса в то, на что можно нажать.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ЭТО ЖИВЁТ В СЛОЕ ПРИЛОЖЕНИЯ
 *
 * Прогресс знает только «вид и идентификатор» — он намеренно ничего
 * не знает о содержимом. Курс знает про уроки и не знает про разборы.
 * Разборы знают про варианты и не знают про уроки.
 *
 * Свести их можно только здесь. Тот же приём уже применён для привязки
 * материалов и для связанных разборов в уроке: слой приложения имеет
 * право обращаться к любому модулю, модули друг к другу — нет.
 *
 * Обещание из шага 6.3 сдержано: эфиры добавились одной веткой `switch`
 * и одним запросом справок. Страницы, прогресс и плеер не тронуты.
 * ─────────────────────────────────────────────────────────────────
 */

export type ResumeCard = {
  /** Что это: определяет подпись «Урок курса», «Разбор» или «Эфир» */
  kind: 'lesson' | 'arrangement' | 'stream'
  title: string
  subtitle: string
  href: string
  percent: number
  completed: boolean
}

/**
 * Что предложить открыть.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗАКОНЧЕННОЕ НЕ ПРЕДЛАГАЕТСЯ, НО И ПУСТОТА НЕ ПОКАЗЫВАЕТСЯ
 *
 * Человек закончил урок вечером и вернулся утром. Предложить ему тот же
 * урок — выглядит как поломка. Не предложить ничего — тоже: он пришёл
 * заниматься, а главная встречает его пустым местом.
 *
 * Поэтому порядок такой:
 *
 *   1. последнее незаконченное — то, что человек бросил на середине;
 *   2. если незаконченного нет — следующий урок курса;
 *   3. если и курс пройден — ничего, и это честно.
 *
 * Второй пункт — причина, по которой эта функция знает про курс: карта
 * курса уже умеет отвечать «куда дальше», и придумывать второй ответ
 * на тот же вопрос было бы неверно.
 * ─────────────────────────────────────────────────────────────────
 */
export async function findResumeCard(viewer: ContentViewer): Promise<ResumeCard | null> {
  const recent = await findResumeCards(viewer, 12)
  const unfinished = recent.find((card) => !card.completed)

  if (unfinished) return unfinished

  return nextCourseLesson(viewer)
}

/**
 * Следующий урок курса как запасной ответ.
 *
 * Годится и новичку, который ещё ничего не открывал: для него это
 * «начать курс», а выглядит одинаково — одна кнопка с одним действием.
 */
async function nextCourseLesson(viewer: ContentViewer): Promise<ResumeCard | null> {
  const map = await getCourseMap(viewer)
  if (!map) return null

  const next = findNextLesson(map.modules)
  if (!next) return null

  return {
    kind: 'lesson',
    title: next.lesson.title,
    subtitle: next.module.title,
    href: routes.app.learn.lesson(next.module.slug, next.lesson.slug),
    percent: 0,
    completed: false,
  }
}

/** То же самое, но списком — для страницы «Мой прогресс» */
export async function findResumeCards(viewer: ContentViewer, limit: number): Promise<ResumeCard[]> {
  if (!viewer.userId) return []

  // Запрашиваем с запасом: часть записей может указывать на содержимое,
  // которое больше не показывается
  const activity = await findRecentActivity(viewer.userId, Math.max(limit * 3, 9))
  if (activity.length === 0) return []

  const lessonIds = activity.filter((row) => row.entityType === 'lesson').map((row) => row.entityId)
  const arrangementIds = activity
    .filter((row) => row.entityType === 'arrangement')
    .map((row) => row.entityId)
  const streamIds = activity.filter((row) => row.entityType === 'stream').map((row) => row.entityId)

  const [lessons, arrangements, streams] = await Promise.all([
    getLessonRefs(viewer, lessonIds),
    getArrangementRefs(viewer, arrangementIds),
    getStreamRefs(viewer, streamIds),
  ])

  const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]))
  const arrangementById = new Map(arrangements.map((item) => [item.id, item]))
  const streamById = new Map(streams.map((item) => [item.id, item]))

  const cards: ResumeCard[] = []

  // Порядок задаёт прогресс — он и есть «последнее, что человек трогал».
  // Раскладка по видам его не меняет
  for (const row of activity) {
    if (cards.length >= limit) break

    const card = toCard(row, lessonById, arrangementById, streamById)
    if (card) cards.push(card)
  }

  return cards
}

type ActivityRow = Awaited<ReturnType<typeof findRecentActivity>>[number]

function toCard(
  row: ActivityRow,
  lessons: Map<string, Awaited<ReturnType<typeof getLessonRefs>>[number]>,
  arrangements: Map<string, Awaited<ReturnType<typeof getArrangementRefs>>[number]>,
  streams: Map<string, Awaited<ReturnType<typeof getStreamRefs>>[number]>,
): ResumeCard | null {
  // Спрашиваем правило, а не смотрим на дату: «пройдено» — это ручная
  // отметка ИЛИ достаточная доля просмотра, и формула живёт в модуле
  // прогресса. Своя проверка здесь означала бы вторую формулу того же
  // самого, которая однажды разойдётся с первой
  const completed = isCompleted(row)

  switch (row.entityType) {
    case 'lesson': {
      const lesson = lessons.get(row.entityId)
      if (!lesson) return null

      return {
        kind: 'lesson',
        title: lesson.title,
        subtitle: lesson.moduleTitle,
        href: routes.app.learn.lesson(lesson.moduleSlug, lesson.lessonSlug),
        percent: row.percent,
        completed,
      }
    }

    case 'arrangement': {
      const arrangement = arrangements.get(row.entityId)
      if (!arrangement) return null

      return {
        kind: 'arrangement',
        title: arrangement.songTitle,
        subtitle: arrangement.artist,
        // Ссылка ведёт на конкретный вариант, а не просто на песню:
        // человек продолжает разбор своего уровня, а не выбирает заново
        href: `${routes.app.learn.song(arrangement.songSlug)}?v=${arrangement.id}`,
        percent: row.percent,
        completed,
      }
    }

    case 'stream': {
      const stream = streams.get(row.entityId)
      if (!stream) return null

      return {
        kind: 'stream',
        title: stream.title,
        subtitle: stream.curatorName ?? 'Запись эфира',
        // Полтора часа записи чаще всего бросают на середине и
        // возвращаются дослушать — ровно тот случай, ради которого
        // «Продолжить» и существует
        href: routes.app.streams.stream(stream.slug),
        percent: row.percent,
        completed,
      }
    }

    // Части разбора и модули прогресс тоже умеет хранить, но продолжать
    // с них нельзя: у части нет своей страницы, а у модуля — своего видео
    default:
      return null
  }
}
