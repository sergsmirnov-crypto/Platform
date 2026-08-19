import { LOG_GROUPS } from './log-catalog'

import type { LogGroup } from './log-catalog'

/**
 * Отбор в журнале действий.
 *
 * ─────────────────────────────────────────────────────────────────
 * СОСТОЯНИЕ ЖИВЁТ В АДРЕСЕ — КАК И В СПИСКЕ УЧАСТНИКОВ
 *
 * Отбор в журнале почти всегда делается ради чужого вопроса: «посмотри,
 * что было с этим разбором». Ссылка отвечает на него целиком, а «открой
 * журнал, нажми на разборы, потом на неделю» — нет.
 *
 * Разбор адреса — чистые функции: `?page=-3&period=хмм` приходит
 * из адресной строки, то есть от кого угодно, и не должен ронять
 * страницу управления.
 * ─────────────────────────────────────────────────────────────────
 */

/** За какой срок смотрим */
export const LOG_PERIODS = ['today', 'week', 'month', 'all'] as const
export type LogPeriod = (typeof LOG_PERIODS)[number]

/** Ссылка на объект: тип и идентификатор, склеенные для адресной строки */
export type LogEntityRef = { type: string; id: string }

export type LogFilters = {
  /** Поиск по названию объекта и по именам участников */
  query: string | null
  /** Раздел: разборы, эфиры, курс, люди, подписки, система */
  group: LogGroup | null
  period: LogPeriod
  /** Всё, что делал один человек */
  actorId: string | null
  /** Вся история одного объекта */
  entity: LogEntityRef | null
  page: number
}

export const DEFAULT_LOG_FILTERS: LogFilters = {
  query: null,
  group: null,
  // Месяц, а не «всё время»: журнал открывают из-за того, что случилось
  // недавно. Более старое ищут отбором, и тогда срок снимают осознанно
  period: 'month',
  actorId: null,
  entity: null,
  page: 1,
}

type RawParams = Record<string, string | string[] | undefined>

function single(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value

  return first?.trim() || null
}

export function parseLogFilters(params: RawParams): LogFilters {
  const group = single(params.group)
  const period = single(params.period)
  const page = Number.parseInt(single(params.page) ?? '', 10)

  return {
    query: single(params.q),
    group: isGroup(group) ? group : null,
    period: isPeriod(period) ? period : DEFAULT_LOG_FILTERS.period,
    actorId: single(params.actor),
    entity: parseEntity(single(params.entity)),
    page: Number.isFinite(page) && page > 1 ? page : 1,
  }
}

/**
 * Собирает адрес обратно.
 *
 * Значения по умолчанию в адрес не попадают: `/app/manage/logs` читается
 * лучше, чем `?period=month&page=1`, и означает ровно то же.
 */
export function buildLogQuery(filters: Partial<LogFilters>): string {
  const params = new URLSearchParams()

  if (filters.query) params.set('q', filters.query)
  if (filters.group) params.set('group', filters.group)
  if (filters.period && filters.period !== DEFAULT_LOG_FILTERS.period) {
    params.set('period', filters.period)
  }
  if (filters.actorId) params.set('actor', filters.actorId)
  if (filters.entity) params.set('entity', `${filters.entity.type}:${filters.entity.id}`)
  if (filters.page && filters.page > 1) params.set('page', String(filters.page))

  const query = params.toString()

  return query ? `?${query}` : ''
}

/** Отбирает ли журнал хоть что-нибудь — для подсказки в пустом состоянии */
export function hasActiveLogFilters(filters: LogFilters): boolean {
  return Boolean(
    filters.query || filters.group || filters.actorId || filters.entity || filters.period !== 'all',
  )
}

/**
 * Начало периода.
 *
 * Считается от текущего момента, а не от начала суток: «за неделю»
 * означает «за последние семь дней». Граница по календарю здесь
 * не нужна никому, а объяснять, почему вчерашнее в «сегодня» не попало,
 * пришлось бы.
 *
 * @param now передаётся снаружи — иначе функцию нельзя проверить тестом
 */
export function periodStart(period: LogPeriod, now: Date): Date | null {
  if (period === 'all') return null

  const days = period === 'today' ? 1 : period === 'week' ? 7 : 30

  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
}

/**
 * Разбирает ссылку на объект вида `song:7f3a-…`.
 *
 * Тип и идентификатор не проверяются на существование: объекта может
 * уже не быть — именно ради таких записей журнал и заведён. Проверяется
 * только форма, чтобы в запрос не ушла произвольная строка.
 */
function parseEntity(value: string | null): LogEntityRef | null {
  if (!value) return null

  const separator = value.indexOf(':')
  if (separator <= 0) return null

  const type = value.slice(0, separator)
  const id = value.slice(separator + 1)

  if (!id || type.length > 40 || id.length > 100) return null

  return { type, id }
}

function isGroup(value: string | null): value is LogGroup {
  return value !== null && (LOG_GROUPS as readonly string[]).includes(value)
}

function isPeriod(value: string | null): value is LogPeriod {
  return value !== null && (LOG_PERIODS as readonly string[]).includes(value)
}
