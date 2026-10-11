/**
 * Публичный вход модуля курса.
 *
 * Наружу — чистые правила, типы и тексты. Чтение из базы живёт
 * в `service.ts` с пометкой `server-only`.
 */
export {
  collectAssetIds,
  collectSongIds,
  contentBlockSchema,
  contentBlocksSchema,
  MAX_BLOCKS,
  parseContentBlocks,
} from '@/shared/blocks'
export type { ContentBlock, ContentBlockType, ContentBlocks } from '@/shared/blocks'

export {
  findNeighbours,
  findNextLesson,
  lessonNumber,
  summarizeCourse,
  summarizeModule,
} from './outline'
export type {
  CourseSummary,
  LessonNeighbours,
  ModuleSummary,
  NextLesson,
  OutlineLesson,
  OutlineModule,
} from './outline'

export { lessonInputSchema, moduleInputSchema, reorderSchema } from './editor-schema'
export type { LessonInput, ModuleInput } from './editor-schema'

export { courseStrings } from './strings'

export type {
  CourseMap,
  LessonListItem,
  LessonPage,
  LessonView,
  LinkedSong,
  ModuleListItem,
} from './types'
