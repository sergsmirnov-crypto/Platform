/**
 * Блочное содержимое: единый формат текста для уроков и новостей.
 *
 * Набор видов блоков закрыт, форматирование задаётся выбором вида,
 * а не разметкой внутри текста (ADR-0018). Отрисовка живёт в слое
 * приложения — здесь только формат и его проверка.
 */
export {
  collectAssetIds,
  collectSongIds,
  contentBlockSchema,
  contentBlocksSchema,
  hasReadableContent,
  MAX_BLOCKS,
  parseContentBlocks,
} from './content'
export type { ContentBlock, ContentBlocks, ContentBlockType } from './content'
