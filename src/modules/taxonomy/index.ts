/**
 * Публичный вход в модуль меток.
 *
 * Метки — общая таксономия для разборов, уроков и эфиров. Модуль
 * намеренно ничего не знает о том, к чему их привязывают: он умеет
 * только «вот метка, вот объект такого-то вида».
 */
export {
  GENRE_TAGS,
  MOOD_TAGS,
  TAG_KIND_LABELS,
  TAG_SEEDS,
  TECHNIQUE_TAGS,
  tagSlug,
} from './catalog'
export { GENRE_NAMES, TAG_KINDS } from './catalog'
export type { TagKind, TagSeed } from './catalog'
