/**
 * Публичный вход в модуль разборов.
 *
 * Здесь перечислено только то, что работает в любом окружении. Всё
 * серверное — сервис и запросы — импортируется явным путём:
 *
 *     import { getCatalogPage } from '@/modules/songs/service'
 *
 * Причина та же, что у остальных модулей: публичный вход тянут в том
 * числе браузерные компоненты, и серверный код через него протаскивать
 * нельзя.
 */
export {
  compareLevels,
  estimateLabel,
  formatDuration,
  isLevel,
  isPubliclyVisible,
  isTuning,
  LEVELS,
  LEVEL_VALUES,
  levelLabel,
  resolveSectionPlayback,
  sectionDuration,
  SECTION_TEMPLATES,
  sectionsFromTemplate,
  songSlug,
  totalDuration,
  TUNINGS,
  TUNING_VALUES,
  tuningLabel,
  uniqueSlug,
} from './domain'
export type { Level, PlaybackSource, SectionTemplate, Tuning } from './domain'

export {
  buildCatalogQuery,
  CATALOG_PRESETS,
  DEFAULT_SORT,
  hasActiveFilters,
  isPresetActive,
  pageCount,
  pageOffset,
  parseCatalogFilters,
  SEARCH_SORT,
  SORT_OPTIONS,
  sortOptionsFor,
} from './catalog-filters'
export type { CatalogFilters, CatalogPreset, RawSearchParams, SortOption } from './catalog-filters'

// Разбор поискового запроса переехал в общий слой (шаг 10.4): им
// пользуются четыре раздела, а не только каталог разборов
export { hasSearch, parseSearchQuery } from '@/shared/search'
export type { SearchQuery } from '@/shared/search'

export {
  groupByLevel,
  hasVariantChoice,
  nearestLevel,
  selectArrangement,
  variantLabel,
} from './arrangement-selection'
export type {
  LevelGroup,
  SelectableArrangement,
  Selection,
  SelectionRequest,
} from './arrangement-selection'

export {
  arrangementInputSchema,
  reorderSchema,
  sectionInputSchema,
  songInputSchema,
} from './editor-schema'
export type { ArrangementInput, SectionInput, SongInput } from './editor-schema'

export { canPublish, findPublicationBlockers, nextStatus } from './publication'
export type { PublicationBlocker } from './publication'

// Таймкоды переехали в общий слой: ими пользуются и эфиры.
// Имя сохранено, чтобы редактор частей разбора остался нетронутым
export { formatTimecode, parseTimecode } from '@/shared/utils/timecode'

export { songStrings } from './strings'

export type {
  ArrangementView,
  CatalogPage,
  MaterialView,
  SectionView,
  SimilarSong,
  SongCard,
  SongSuggestion,
  SongView,
  TagView,
} from './types'

export { starterAttempts } from './starter'
export type { StarterAttempt } from './starter'
