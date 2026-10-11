/**
 * Публичный вход в модуль медиа.
 *
 * Модуль отвечает на два вопроса: что это за файл и можно ли его сейчас
 * отдать этому человеку. Где файл лежит физически — знает `shared/storage`,
 * оплачена ли подписка — модуль `subscription`.
 *
 * Здесь перечислено только то, что работает в любом окружении.
 * Выдача ссылок — серверная и импортируется явным путём:
 *
 *     import { getDownloadTicket } from '@/modules/media/service'
 *
 * Причина та же, что у остальных модулей: публичный вход тянут в том
 * числе браузерные компоненты, и серверный код через него протаскивать
 * нельзя.
 */
export {
  canDownload,
  canViewInline,
  formatFileSize,
  isExternalKind,
  isFileKind,
  isMediaKind,
  isReady,
  kindLabel,
  materialTitle,
  MEDIA_KINDS,
} from './domain'
export type { MediaKind } from './domain'

export { buildChapters, PLAYBACK_TOKEN_TTL_SECONDS, watermarkText } from './playback'
export type { ChapterSource } from './playback'

export {
  defaultMaterialTitle,
  describeUpload,
  externalMaterialSchema,
  externalProvider,
  fileExtension,
  MATERIAL_TITLE_MAX,
  materialTitleSchema,
  MAX_UPLOAD_BYTES,
  UPLOAD_ACCEPT,
  UPLOAD_RULES,
  uploadErrors,
} from './upload'
export type { ExternalMaterialInput, UploadDescriptor, UploadRule } from './upload'

export { mediaStrings } from './strings'

export type {
  DownloadTicket,
  EditorMaterial,
  MaterialAsset,
  MaterialView,
  PlaybackTicket,
} from './types'
