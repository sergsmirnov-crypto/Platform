import { z } from 'zod'

import { UPLOAD_LIMITS } from '@/shared/storage/keys'

import type { MediaKind } from './domain'

/**
 * Что разрешено загружать и под каким видом это хранится.
 *
 * Ни базы, ни сети, ни хранилища — только правила. Поэтому файл покрыт
 * тестами целиком и одинаково доступен серверу и браузеру: форма
 * отсеивает лишнее до отправки теми же правилами, какими сервер
 * проверит присланное после.
 *
 * ─────────────────────────────────────────────────────────────────
 * ВИД ФАЙЛА ОПРЕДЕЛЯЕТСЯ ПО РАСШИРЕНИЮ, А НЕ ПО ТИПУ ОТ БРАУЗЕРА
 *
 * У Guitar Pro нет зарегистрированного типа содержимого: браузер
 * присылает `application/octet-stream` и для партитуры, и для чего
 * угодно ещё. Опираться на такой признак нельзя.
 *
 * Побочная выгода важнее главной. Тип, присланный браузером, — это
 * значение, которое задаёт тот, кто загружает. Файл, объявленный
 * картинкой, но содержащий разметку со скриптом, выполнился бы
 * в браузере того, кто его откроет. Здесь тип содержимого назначаем
 * мы сами, по расширению из белого списка, и в хранилище уезжает
 * именно он.
 * ─────────────────────────────────────────────────────────────────
 */

export type UploadRule = {
  kind: MediaKind
  /** Тип, под которым файл ляжет в хранилище. Присланному не доверяем */
  contentType: string
  limitBytes: number
}

/**
 * Белый список расширений.
 *
 * Именно белый: «всё, кроме опасного» — способ однажды забыть очередное
 * расширение. Чего нет в списке, того загрузить нельзя.
 *
 * Видео здесь отсутствует намеренно и появиться не должно: ролики живут
 * на видеохостинге, а не в нашем хранилище (ADR-0014).
 */
export const UPLOAD_RULES: Record<string, UploadRule> = {
  pdf: { kind: 'pdf', contentType: 'application/pdf', limitBytes: UPLOAD_LIMITS.documentBytes },

  gp: { kind: 'guitar_pro', contentType: 'application/octet-stream', limitBytes: UPLOAD_LIMITS.guitarProBytes }, // prettier-ignore
  gp3: { kind: 'guitar_pro', contentType: 'application/octet-stream', limitBytes: UPLOAD_LIMITS.guitarProBytes }, // prettier-ignore
  gp4: { kind: 'guitar_pro', contentType: 'application/octet-stream', limitBytes: UPLOAD_LIMITS.guitarProBytes }, // prettier-ignore
  gp5: { kind: 'guitar_pro', contentType: 'application/octet-stream', limitBytes: UPLOAD_LIMITS.guitarProBytes }, // prettier-ignore
  gpx: { kind: 'guitar_pro', contentType: 'application/octet-stream', limitBytes: UPLOAD_LIMITS.guitarProBytes }, // prettier-ignore
  gtp: { kind: 'guitar_pro', contentType: 'application/octet-stream', limitBytes: UPLOAD_LIMITS.guitarProBytes }, // prettier-ignore

  mp3: { kind: 'audio', contentType: 'audio/mpeg', limitBytes: UPLOAD_LIMITS.audioBytes },
  m4a: { kind: 'audio', contentType: 'audio/mp4', limitBytes: UPLOAD_LIMITS.audioBytes },
  ogg: { kind: 'audio', contentType: 'audio/ogg', limitBytes: UPLOAD_LIMITS.audioBytes },

  jpg: { kind: 'image', contentType: 'image/jpeg', limitBytes: UPLOAD_LIMITS.imageBytes },
  jpeg: { kind: 'image', contentType: 'image/jpeg', limitBytes: UPLOAD_LIMITS.imageBytes },
  png: { kind: 'image', contentType: 'image/png', limitBytes: UPLOAD_LIMITS.imageBytes },
  webp: { kind: 'image', contentType: 'image/webp', limitBytes: UPLOAD_LIMITS.imageBytes },
}

/**
 * Значение для поля выбора файла.
 *
 * Собирается из списка, а не пишется руками рядом: два перечня одного
 * и того же расходятся при первой же правке, и человек выбирает файл,
 * который сервер потом отвергает.
 */
export const UPLOAD_ACCEPT = Object.keys(UPLOAD_RULES)
  .map((extension) => `.${extension}`)
  .join(',')

/** Самый щедрый предел. Нужен как грубая отсечка до разбора имени файла */
export const MAX_UPLOAD_BYTES = Math.max(
  ...Object.values(UPLOAD_RULES).map((rule) => rule.limitBytes),
)

export const uploadErrors = {
  missing: 'Выберите файл',
  empty: 'Файл пустой',
  unsupported: 'Такой файл загрузить нельзя. Подойдут PDF, Guitar Pro, аудио и картинки',
  tooLarge: (limitBytes: number) => `Файл больше ${Math.round(limitBytes / 1024 / 1024)} МБ`,
  failed: 'Не удалось загрузить файл. Попробуйте ещё раз',
} as const

/** Расширение в нижнем регистре, без точки. Пустая строка — расширения нет */
export function fileExtension(fileName: string): string {
  // Берём только последний участок пути: браузеры на Windows иногда
  // присылают имя целиком, вида «C:\Users\...\tabs.pdf»
  const base = fileName.split(/[\\/]/).pop() ?? ''
  const dot = base.lastIndexOf('.')

  if (dot <= 0 || dot === base.length - 1) return ''

  return base.slice(dot + 1).toLowerCase()
}

export type UploadDescriptor = UploadRule & { extension: string }

/**
 * Что это за файл и можно ли его принять.
 *
 * `null` означает «не принимаем» — единственный ответ на вопрос про
 * расширение, которого нет в списке. Причину отказа формулирует
 * вызывающий: она одна и та же для всех неизвестных расширений.
 */
export function describeUpload(fileName: string): UploadDescriptor | null {
  const extension = fileExtension(fileName)
  const rule = UPLOAD_RULES[extension]

  if (!rule) return null

  return { ...rule, extension }
}

/**
 * Подпись материала по умолчанию — имя файла без расширения.
 *
 * Куратор почти никогда не заполняет подпись руками, а «Табы (PDF)»
 * трижды подряд неразличимы. Имя файла обычно осмысленно:
 * «nothing-else-matters-solo» лучше любого значения по умолчанию.
 */
export function defaultMaterialTitle(fileName: string): string | null {
  const base = fileName.split(/[\\/]/).pop() ?? ''
  const extension = fileExtension(base)

  // Отрезаем ровно то, что признано расширением: иначе «Прогулка 2.5.pdf»
  // превратилась бы в «Прогулка 2», а «README» — в пустоту
  const withoutExtension = extension ? base.slice(0, -(extension.length + 1)) : base

  const cleaned = withoutExtension.trim().slice(0, MATERIAL_TITLE_MAX)

  return cleaned || null
}

/** Предел длины подписи. Длиннее — и список материалов расползается */
export const MATERIAL_TITLE_MAX = 120

/**
 * Подпись материала.
 *
 * Пустая строка приводится к `null`: в базе «нет подписи» должно
 * выглядеть одним способом, иначе проверка `title ?? kindLabel`
 * пропустит пустую строку и покажет участнику пустое место.
 */
export const materialTitleSchema = z
  .string()
  .trim()
  .max(MATERIAL_TITLE_MAX, `Не длиннее ${MATERIAL_TITLE_MAX} символов`)
  .transform((value) => value || null)
  .nullable()

/**
 * Внешний материал: интерактивные табы.
 *
 * Это не файл, а чужая страница — у неё есть адрес, но нет содержимого,
 * которое можно положить на диск. Поэтому отдельная форма и отдельный
 * вид материала.
 */
export const externalMaterialSchema = z.object({
  url: z
    .url('Нужен полный адрес, начиная с https://')
    .max(500, 'Слишком длинный адрес')
    .refine((value) => value.startsWith('https://'), {
      message: 'Только адреса на https://',
    }),
  title: materialTitleSchema,
})

export type ExternalMaterialInput = z.infer<typeof externalMaterialSchema>

/**
 * Поставщик внешнего материала.
 *
 * Различаем только Soundslice: он единственный, у кого есть встраиваемый
 * проигрыватель табов, и когда дойдут руки до встраивания, отличать его
 * от произвольной ссылки понадобится. Всё остальное — просто «внешнее».
 */
export function externalProvider(url: string): 'soundslice' | 'external' {
  return /(^|\.)soundslice\.com$/i.test(safeHost(url)) ? 'soundslice' : 'external'
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}
