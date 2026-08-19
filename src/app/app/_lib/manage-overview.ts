import 'server-only'

import { DEFAULT_LOG_FILTERS, getAuditLogPage } from '@/modules/audit'
import type { AuditEntry } from '@/modules/audit'
import { getCourseOverview } from '@/modules/course/editor-service'
import { getFailedAssetCount } from '@/modules/media/service'
import { getSongsOverview } from '@/modules/songs/editor-service'
import { getStreamsOverview } from '@/modules/streams/editor-service'
import { getSubscriptionOverview } from '@/modules/subscription/admin'
import { appConfig } from '@/shared/config'

import { buildOverviewCounters, buildOverviewTasks } from './manage-overview-tasks'
import { viewerCan } from './viewer'

import type { OverviewCounter, OverviewTask } from './manage-overview-tasks'
import type { Viewer } from './viewer'

/**
 * Данные экрана «Управление → Обзор».
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ СБОРКА ЖИВЁТ ЗДЕСЬ, А НЕ В МОДУЛЕ
 *
 * Обзор — единственный экран платформы, которому нужны сразу шесть
 * предметных областей: разборы, эфиры, курс, медиа, подписки, журнал.
 * Модуль, знающий обо всех шести, нарушил бы главное правило проекта
 * и стал бы тем местом, куда со временем сваливают всё подряд.
 *
 * Складывать ответы модулей — работа слоя приложения. Так же устроена
 * кнопка «Продолжить» на главной (`resume.ts`).
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗАПРАШИВАЕТСЯ ТОЛЬКО ТО, НА ЧТО ЕСТЬ ПРАВА
 *
 * Куратор без прав на курс не должен ждать запроса о курсе — и тем
 * более не должен получить отказ в правах посреди отрисовки главной
 * страницы раздела. Поэтому проверка стоит до запроса, а не после.
 *
 * Права спрашиваются через `viewerCan`: только он учитывает режим
 * «смотреть как участник». Сами модули проверяют их ещё раз у себя —
 * здесь это выбор «спрашивать или не спрашивать», а не защита.
 * ─────────────────────────────────────────────────────────────────
 */

export type { OverviewCounter, OverviewTask } from './manage-overview-tasks'

export type ManageOverview = {
  tasks: OverviewTask[]
  counters: OverviewCounter[]
  recentActions: AuditEntry[]
  /** Не было ни одного повода для беспокойства */
  isCalm: boolean
}

/** Сколько объектов показывать в каждой заботе */
const TASK_ITEM_LIMIT = 5
/** Сколько последних действий команды показывать */
const RECENT_ACTIONS_LIMIT = 6

export async function getManageOverview(
  viewer: Viewer & { userId: string },
  now: Date = new Date(),
): Promise<ManageOverview> {
  const publishedSince = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const staleBefore = new Date(
    now.getTime() - appConfig.manage.staleDraftDays * 24 * 60 * 60 * 1000,
  )

  const [songs, streams, course, failedAssets, subscriptions, actions] = await Promise.all([
    viewerCan(viewer, 'songs.view_drafts')
      ? getSongsOverview(viewer.userId, { publishedSince, staleBefore, limit: TASK_ITEM_LIMIT })
      : null,

    viewerCan(viewer, 'streams.view_drafts')
      ? getStreamsOverview(viewer.userId, { publishedSince, now, limit: TASK_ITEM_LIMIT })
      : null,

    viewerCan(viewer, 'course.view_drafts')
      ? getCourseOverview(viewer.userId, TASK_ITEM_LIMIT)
      : null,

    viewerCan(viewer, 'media.view_all') ? getFailedAssetCount(viewer.userId) : null,

    viewerCan(viewer, 'subs.view') ? getSubscriptionOverview(viewer.userId) : null,

    viewerCan(viewer, 'audit.view')
      ? getAuditLogPage(viewer.userId, { ...DEFAULT_LOG_FILTERS, period: 'week' }, now)
      : null,
  ])

  const tasks = buildOverviewTasks({ songs, streams, course, failedAssets, subscriptions })
  const counters = buildOverviewCounters({ songs, streams, course })

  return {
    tasks,
    counters,
    recentActions: actions?.entries.slice(0, RECENT_ACTIONS_LIMIT) ?? [],
    // «Спокойно» — это отсутствие забот при наличии права хоть что-то
    // о них узнать. Куратору без прав показывать «всё в порядке» нельзя:
    // он ничего и не проверял
    isCalm: tasks.length === 0 && (songs !== null || streams !== null || course !== null),
  }
}
