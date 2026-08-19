import { tagSlug } from '@/modules/taxonomy'
import { appConfig } from '@/shared/config/app.config'

import { isLevel, isTuning } from './domain'

import type { Level, Tuning } from './domain'

/**
 * Фильтры каталога разборов.
 *
 * ─────────────────────────────────────────────────────────────────
 * ФИЛЬТРЫ ЖИВУТ В АДРЕСНОЙ СТРОКЕ, А НЕ В ПАМЯТИ СТРАНИЦЫ
 *
 * Из этого бесплатно получается всё, чего иначе пришлось бы добиваться
 * руками: работающая кнопка «назад», возможность отправить товарищу
 * ссылку на «фингерстайл в DADGAD для начинающих», сохранение выбора
 * при перезагрузке и отрисовка каталога сразу на сервере, без мигания
 * пустым списком (ARCHITECTURE §11).
 *
 * Плата — разбор строки адреса. Он здесь: чистая функция, ничего
 * не знающая ни о React, ни о базе, поэтому проверенная тестами.
 * ─────────────────────────────────────────────────────────────────
 *
 * Правило разбора: **мусор игнорируется, а не отвергается.** Адрес
 * правят руками, присылают друг другу и режут при копировании.
 * `?level=надёжный` должен показать каталог без фильтра по уровню,
 * а не страницу ошибки.
 */

export const SORT_OPTIONS = [
  /**
   * Порядок по совпадению.
   *
   * Показывается в списке только когда есть поисковый запрос: в пустом
   * каталоге сортировать по совпадению не с чем, а пункт-обманка в меню
   * хуже отсутствующего.
   */
  { value: 'relevance', label: 'По совпадению', requiresQuery: true },
  { value: 'new', label: 'Сначала новые' },
  { value: 'popular', label: 'Популярные' },
  { value: 'alphabet', label: 'По алфавиту' },
  { value: 'level', label: 'От простого к сложному' },
] as const

export type SortOption = (typeof SORT_OPTIONS)[number]['value']

const SORT_VALUES = SORT_OPTIONS.map((option) => option.value) as SortOption[]

export const DEFAULT_SORT: SortOption = 'new'

/**
 * Порядок при поиске.
 *
 * Найденное сортируется по совпадению, а не по дате. Иначе точное
 * попадание оказывается седьмым в списке только потому, что песню
 * добавили давно, — и человек решает, что поиск не работает.
 */
export const SEARCH_SORT: SortOption = 'relevance'

/** Пункты порядка, уместные при текущем состоянии каталога */
export function sortOptionsFor(hasQuery: boolean) {
  return SORT_OPTIONS.filter((option) => hasQuery || !('requiresQuery' in option))
}

export type CatalogFilters = {
  /** Свободный поиск по названию и исполнителю */
  query: string | null
  levels: Level[]
  tunings: Tuning[]
  /** Метки: жанры и техники, по адресным именам */
  tags: string[]
  curatorId: string | null
  /** «Разберу за вечер»: не длиннее стольких минут. `null` — без ограничения */
  maxMinutes: number | null
  sort: SortOption
  page: number
  /** Показывать ли черновики. Ставится сервером по правам, не из адреса */
  includeDrafts: boolean
}

/** Как параметры приходят из Next.js */
export type RawSearchParams = Record<string, string | string[] | undefined>

/**
 * Приводит параметр к списку значений.
 *
 * Поддерживаются оба вида записи: `?level=beginner&level=advanced`
 * и `?level=beginner,advanced`. Первый рождается у форм, второй —
 * когда ссылку составляют руками.
 */
function toList(value: string | string[] | undefined): string[] {
  if (value === undefined) return []

  const parts = Array.isArray(value) ? value : [value]

  return parts
    .flatMap((part) => part.split(','))
    .map((part) => part.trim())
    .filter((part) => part !== '')
}

function toSingle(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value
  const trimmed = first?.trim()

  return trimmed ? trimmed : null
}

/** Слишком длинный запрос — это не поиск, а попытка нагрузить базу */
const MAX_QUERY_LENGTH = 100

/**
 * Какой порядок применить.
 *
 * Без явного указания в адресе: есть запрос — по совпадению, нет —
 * сначала новые. Порядок «по совпадению» без запроса отбрасывается:
 * такая ссылка приходит, когда человек искал, а потом стёр запрос,
 * и сортировать ей нечего.
 */
function resolveSort(sort: string | null, query: string | null): SortOption {
  const known = sort && SORT_VALUES.includes(sort as SortOption) ? (sort as SortOption) : null

  if (known === 'relevance' && !query) return DEFAULT_SORT
  if (known) return known

  return query ? SEARCH_SORT : DEFAULT_SORT
}

export function parseCatalogFilters(params: RawSearchParams): CatalogFilters {
  const rawPage = Number.parseInt(toSingle(params.page) ?? '', 10)
  const rawMinutes = Number.parseInt(toSingle(params.minutes) ?? '', 10)
  const sort = toSingle(params.sort)
  const query = toSingle(params.q)?.slice(0, MAX_QUERY_LENGTH) ?? null

  return {
    query,
    // Повторы убираются: `?level=beginner&level=beginner` — это один уровень
    levels: [...new Set(toList(params.level).filter(isLevel))],
    tunings: [...new Set(toList(params.tuning).filter(isTuning))],
    tags: [...new Set(toList(params.tag))].slice(0, 10),
    curatorId: toSingle(params.curator),
    maxMinutes: Number.isFinite(rawMinutes) && rawMinutes > 0 ? Math.min(rawMinutes, 600) : null,
    sort: resolveSort(sort, query),
    page: Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1,
    includeDrafts: false,
  }
}

/** Выбрал ли человек хоть что-нибудь: от этого зависит кнопка «сбросить» */
export function hasActiveFilters(filters: CatalogFilters): boolean {
  return (
    filters.query !== null ||
    filters.levels.length > 0 ||
    filters.tunings.length > 0 ||
    filters.tags.length > 0 ||
    filters.curatorId !== null ||
    filters.maxMinutes !== null
  )
}

/**
 * Собирает адрес обратно.
 *
 * Значения по умолчанию не пишутся: адрес каталога без фильтров должен
 * выглядеть как `/app/learn/songs`, а не как строка с семью пустыми
 * параметрами. Такую ссылку не стыдно отправить.
 */
export function buildCatalogQuery(filters: Partial<CatalogFilters>): string {
  const search = new URLSearchParams()

  if (filters.query) search.set('q', filters.query)
  for (const level of filters.levels ?? []) search.append('level', level)
  for (const tuning of filters.tunings ?? []) search.append('tuning', tuning)
  for (const tag of filters.tags ?? []) search.append('tag', tag)
  if (filters.curatorId) search.set('curator', filters.curatorId)
  if (filters.maxMinutes) search.set('minutes', String(filters.maxMinutes))
  if (filters.sort && filters.sort !== DEFAULT_SORT) search.set('sort', filters.sort)
  if (filters.page && filters.page > 1) search.set('page', String(filters.page))

  const query = search.toString()

  return query ? `?${query}` : ''
}

/** Сколько записей пропустить при выборке */
export function pageOffset(page: number, pageSize = appConfig.catalog.pageSize): number {
  return Math.max(0, (page - 1) * pageSize)
}

/** Сколько всего страниц. Ноль записей — всё равно одна страница */
export function pageCount(total: number, pageSize = appConfig.catalog.pageSize): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

/**
 * Быстрые подборки над каталогом.
 *
 * Отвечают на вопрос, с которым человек приходит на самом деле: не
 * «покажи разборы уровня intermediate в строе DADGAD», а «что мне
 * разобрать сегодня вечером». Набор из пяти готовых ответов закрывает
 * большинство заходов и избавляет от возни с фильтрами (PRD v0.1 §5.2).
 *
 * Адресные имена меток не пишутся строками, а собираются той же
 * функцией, что и при заполнении справочника: опечатка в `'russkiy-rok'`
 * не сломала бы сборку, а подборка молча перестала бы что-либо находить.
 */
export const CATALOG_PRESETS = [
  {
    value: 'beginner',
    label: 'Для новичка',
    filters: { levels: ['beginner'] as Level[] },
  },
  {
    value: 'evening',
    label: 'Разберу за вечер',
    filters: { maxMinutes: 60 },
  },
  {
    value: 'russian-rock',
    label: 'Русский рок',
    filters: { tags: [tagSlug('genre', 'Русский рок')] },
  },
  {
    value: 'fingerstyle',
    label: 'Фингерстайл',
    filters: { tags: [tagSlug('technique', 'Фингерстайл')] },
  },
  {
    value: 'no-retune',
    label: 'Без перестройки',
    filters: { tunings: ['e_standard'] as Tuning[] },
  },
] as const

export type CatalogPreset = (typeof CATALOG_PRESETS)[number]

/**
 * Выбрана ли подборка сейчас.
 *
 * Сравнение по включению, а не по равенству: человек мог открыть
 * «Для новичка» и дополнительно выбрать строй. Подборка при этом
 * остаётся подсвеченной — она по-прежнему описывает то, что он видит.
 */
export function isPresetActive(preset: CatalogPreset, filters: CatalogFilters): boolean {
  const wanted = preset.filters as {
    levels?: readonly Level[]
    tunings?: readonly Tuning[]
    tags?: readonly string[]
    maxMinutes?: number
  }

  if (wanted.levels && !wanted.levels.every((level) => filters.levels.includes(level))) return false
  if (wanted.tunings && !wanted.tunings.every((tuning) => filters.tunings.includes(tuning))) {
    return false
  }
  if (wanted.tags && !wanted.tags.every((tag) => filters.tags.includes(tag))) return false
  if (wanted.maxMinutes && filters.maxMinutes !== wanted.maxMinutes) return false

  return true
}
