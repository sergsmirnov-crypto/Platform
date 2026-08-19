/**
 * Поиск: разбор запроса, напечатанного человеком.
 *
 * Инструмент общего слоя. Знает про раскладки, транслитерацию
 * и опечатки — и ничего не знает ни про разборы, ни про уроки,
 * ни про эфиры.
 */
export {
  fixKeyboardLayout,
  hasSearch,
  MAX_QUERY_LENGTH,
  parseSearchQuery,
  similarityInputs,
  splitTerms,
  transliterate,
} from './query'
export type { SearchQuery } from './query'
