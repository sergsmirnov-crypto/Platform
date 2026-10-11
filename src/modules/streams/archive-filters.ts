import { appConfig } from '@/shared/config/app.config'

/**
 * Фильтры архива записей.
 *
 * ─────────────────────────────────────────────────────────────────
 * ТОТ ЖЕ ПРИЁМ, ЧТО В КАТАЛОГЕ РАЗБОРОВ: СОСТОЯНИЕ В АДРЕСЕ
 *
 * Из адресной строки бесплатно получается работающая кнопка «назад»,
 * ссылка на «все эфиры Ивана», сохранение выбора при перезагрузке
 * и отрисовка на сервере без мигания пустым списком (ARCHITECTURE §11).
 * ─────────────────────────────────────────────────────────────────
 *
 * Фильтров здесь втрое меньше, чем у разборов, и это осознанно: у клуба
 * сорок эфиров. Поиск по теме и отбор по куратору закрывают всё; год,
 * длительность и тема, добавленные «на вырост», просто заняли бы место
 * на экране. Вернуться к ним стоит после двухсот записей.
 *
 * Правило разбора общее для платформы: **мусор игнорируется,
 * а не отвергается.** Адрес правят руками и режут при копировании;
 * `?page=абв` должен показать первую страницу, а не ошибку.
 */

export type ArchiveFilters = {
  /** Свободный поиск по теме и описанию */
  query: string | null
  curatorId: string | null
  page: number
}

/** Как параметры приходят из Next.js */
export type RawSearchParams = Record<string, string | string[] | undefined>

/** Слишком длинный запрос — это не поиск, а попытка нагрузить базу */
const MAX_QUERY_LENGTH = 100

/**
 * Идентификатор куратора приходит из адреса, то есть от кого угодно.
 * Проверяем форму до запроса: непохожее на идентификатор значение —
 * это не «ничего не найдено», а отсутствие фильтра.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function toSingle(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value
  const trimmed = first?.trim()

  return trimmed ? trimmed : null
}

export function parseArchiveFilters(params: RawSearchParams): ArchiveFilters {
  const rawPage = Number.parseInt(toSingle(params.page) ?? '', 10)
  const query = toSingle(params.q)
  const curatorId = toSingle(params.curator)

  return {
    query: query ? query.slice(0, MAX_QUERY_LENGTH) : null,
    curatorId: curatorId && UUID_PATTERN.test(curatorId) ? curatorId : null,
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
  }
}

/**
 * Сборка адреса из фильтров.
 *
 * Значения по умолчанию в адрес не пишутся: `/app/streams` короче
 * и понятнее, чем `/app/streams?page=1`, а ведут они в одно место.
 */
export function buildArchiveQuery(filters: Partial<ArchiveFilters>): string {
  const params = new URLSearchParams()

  if (filters.query) params.set('q', filters.query)
  if (filters.curatorId) params.set('curator', filters.curatorId)
  if (filters.page && filters.page > 1) params.set('page', String(filters.page))

  const query = params.toString()

  return query ? `?${query}` : ''
}

/** Сколько записей пропустить для запрошенной страницы */
export function archiveOffset(page: number): number {
  return (Math.max(1, page) - 1) * appConfig.streams.archivePageSize
}

/** Задан ли хоть один фильтр — от этого зависит текст пустого экрана */
export function hasArchiveFilters(filters: ArchiveFilters): boolean {
  return filters.query !== null || filters.curatorId !== null
}

/**
 * Слова запроса для подсветки в списке.
 *
 * Берутся из того же значения, что ушло в поиск: подсветить не то,
 * что искалось, хуже, чем не подсветить вовсе. Разбор проще, чем
 * у разборов песен, — там ещё чинится раскладка клавиатуры, а тему
 * эфира набирают по-русски и осознанно.
 */
export function searchTerms(query: string | null): string[] {
  if (!query) return []

  return query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 1)
}
