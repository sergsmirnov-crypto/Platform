/**
 * Отбор и порядок в списке участников.
 *
 * ─────────────────────────────────────────────────────────────────
 * СОСТОЯНИЕ СПИСКА ЖИВЁТ В АДРЕСЕ
 *
 * Из этого бесплатно получается работающая кнопка «назад», ссылка
 * «посмотри на этих троих», которую можно отправить второму
 * администратору, и сохранение отбора при перезагрузке страницы.
 *
 * Разбор адреса вынесен в чистые функции по той же причине, что и всюду
 * в проекте: `?page=-3&sort=хмм` приходит из адресной строки, то есть
 * от кого угодно, и не должен ронять страницу.
 * ─────────────────────────────────────────────────────────────────
 */

/** По какому признаку отбирать по доступу */
export const MEMBER_ACCESS_FILTERS = ['active', 'grace', 'expired', 'none'] as const
export type MemberAccessFilter = (typeof MEMBER_ACCESS_FILTERS)[number]

export const MEMBER_SORTS = ['recent', 'joined', 'name'] as const
export type MemberSort = (typeof MEMBER_SORTS)[number]

export type MemberFilters = {
  /** Поиск по имени, городу и имени пользователя в Telegram */
  query: string | null
  /** Состояние доступа. Пусто — все */
  access: MemberAccessFilter | null
  /** Только те, у кого есть хоть одна роль */
  team: boolean
  /** Только заблокированные */
  blocked: boolean
  sort: MemberSort
  page: number
}

export const DEFAULT_MEMBER_FILTERS: MemberFilters = {
  query: null,
  access: null,
  team: false,
  blocked: false,
  // По умолчанию — «кто заходил недавно»: администратор открывает список,
  // когда разбирается с живым человеком, а не изучает историю клуба
  sort: 'recent',
  page: 1,
}

type RawParams = Record<string, string | string[] | undefined>

function single(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value

  return first?.trim() || null
}

export function parseMemberFilters(params: RawParams): MemberFilters {
  const access = single(params.access)
  const sort = single(params.sort)
  const page = Number.parseInt(single(params.page) ?? '', 10)

  return {
    query: single(params.q),
    access: isAccessFilter(access) ? access : null,
    team: single(params.team) === '1',
    blocked: single(params.blocked) === '1',
    sort: isSort(sort) ? sort : DEFAULT_MEMBER_FILTERS.sort,
    // Отрицательная и нечисловая страница — это первая страница,
    // а не пятисотая ошибка
    page: Number.isFinite(page) && page > 1 ? page : 1,
  }
}

/**
 * Собирает адрес обратно.
 *
 * Значения по умолчанию в адрес не попадают: `/app/manage/members`
 * читается лучше, чем `?sort=recent&page=1`, и означает ровно то же.
 */
export function buildMemberQuery(filters: Partial<MemberFilters>): string {
  const params = new URLSearchParams()

  if (filters.query) params.set('q', filters.query)
  if (filters.access) params.set('access', filters.access)
  if (filters.team) params.set('team', '1')
  if (filters.blocked) params.set('blocked', '1')
  if (filters.sort && filters.sort !== DEFAULT_MEMBER_FILTERS.sort) params.set('sort', filters.sort)
  if (filters.page && filters.page > 1) params.set('page', String(filters.page))

  const query = params.toString()

  return query ? `?${query}` : ''
}

/** Отбирает ли список хоть что-нибудь — для подсказки в пустом состоянии */
export function hasActiveMemberFilters(filters: MemberFilters): boolean {
  return Boolean(filters.query || filters.access || filters.team || filters.blocked)
}

function isAccessFilter(value: string | null): value is MemberAccessFilter {
  return value !== null && (MEMBER_ACCESS_FILTERS as readonly string[]).includes(value)
}

function isSort(value: string | null): value is MemberSort {
  return value !== null && (MEMBER_SORTS as readonly string[]).includes(value)
}
