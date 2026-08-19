/**
 * Правила обращения с файлами и видео.
 *
 * Ни базы, ни сети, ни хранилища — только знание о том, что за файл
 * перед нами и что с ним можно делать. Поэтому файл покрыт тестами
 * целиком и одинаково доступен серверу и браузеру: список материалов
 * в браузере подписывает их теми же функциями, какими сервер решает,
 * выдавать ли ссылку.
 */

/** Виды файлов — те же значения, что в перечислении базы */
export const MEDIA_KINDS = [
  'video',
  'pdf',
  'guitar_pro',
  'audio',
  'image',
  'interactive_tab',
  'other',
] as const

export type MediaKind = (typeof MEDIA_KINDS)[number]

export function isMediaKind(value: unknown): value is MediaKind {
  return typeof value === 'string' && (MEDIA_KINDS as readonly string[]).includes(value)
}

/**
 * Видео живёт по своим правилам.
 *
 * Оно не лежит в нашем хранилище, отдаётся не ссылкой на файл,
 * а потоком с видеохостинга, и скачиваться не должно никогда —
 * ради этого хостинг и выбирается (PRD v0.2 §2). Поэтому везде,
 * где речь о выдаче файла, видео отделяется первой же проверкой.
 */
export function isFileKind(kind: MediaKind): boolean {
  return kind !== 'video'
}

/**
 * Открывается ли материал по внешней ссылке, а не скачиванием.
 *
 * Интерактивные табы (Soundslice и подобные) — это чужая страница,
 * а не файл: у неё есть адрес, но нет содержимого, которое можно
 * положить на диск.
 */
export function isExternalKind(kind: MediaKind): boolean {
  return kind === 'interactive_tab'
}

/**
 * Можно ли отдать этот файл участнику.
 *
 * Две причины отказа, и они разные по смыслу: видео не скачивается
 * никогда, остальное — пока куратор не разрешил. Различать их важно,
 * потому что участнику показываются разные объяснения.
 */
export function canDownload(asset: { kind: MediaKind; isDownloadable: boolean }): boolean {
  return isFileKind(asset.kind) && !isExternalKind(asset.kind) && asset.isDownloadable
}

/**
 * Название вида материала.
 *
 * Куратор чаще всего не заполняет подпись к файлу, а «Материал» рядом
 * с «Материал» ничего человеку не говорит. Вид файла известен всегда,
 * и по нему видно, что это: партитуру от минусовки отличают с одного
 * взгляда.
 */
const KIND_LABELS: Record<MediaKind, string> = {
  video: 'Видео',
  pdf: 'Табы (PDF)',
  guitar_pro: 'Guitar Pro',
  audio: 'Минусовка',
  image: 'Изображение',
  interactive_tab: 'Интерактивные табы',
  other: 'Материал',
}

export function kindLabel(kind: MediaKind): string {
  return KIND_LABELS[kind]
}

/** Подпись материала: своя, если куратор её задал, иначе по виду файла */
export function materialTitle(title: string | null, kind: MediaKind): string {
  return title?.trim() || kindLabel(kind)
}

/**
 * Размер файла словами.
 *
 * Показывается рядом с кнопкой скачивания: на мобильном интернете
 * разница между двумя мегабайтами и сорока — это разница между
 * «нажму сейчас» и «подожду до дома».
 */
export function formatFileSize(bytes: number | null): string | null {
  if (bytes === null || bytes <= 0) return null

  const megabytes = bytes / (1024 * 1024)
  if (megabytes >= 1) return `${megabytes.toFixed(megabytes >= 10 ? 0 : 1)} МБ`

  const kilobytes = Math.max(1, Math.round(bytes / 1024))

  return `${kilobytes} КБ`
}

/**
 * Готов ли файл к выдаче.
 *
 * Загрузка и обработка занимают время, и всё это время запись в базе
 * уже существует. Материал в состоянии «обрабатывается» показывается
 * с пояснением, а не кнопкой, которая приведёт к ошибке.
 */
export function isReady(processingStatus: string): boolean {
  return processingStatus === 'ready'
}

/**
 * Можно ли показать материал рядом с видео (шаг 10.6).
 *
 * ─────────────────────────────────────────────────────────────────
 * ТОЛЬКО PDF И КАРТИНКИ, И ЭТО НЕ ОГРАНИЧЕНИЕ ПЕРВОЙ ВЕРСИИ
 *
 * Guitar Pro — формат для программы, а не для просмотрщика: показать
 * его в браузере можно только своим отрисовщиком нотного стана, а это
 * отдельный продукт, а не панель сбоку.
 *
 * Минусовка не читается глазами, интерактивные табы живут на чужом
 * сайте и открываются по ссылке. Остаются PDF и картинка — то, чем
 * табы и бывают на самом деле (v0.2 §3.2: часть табов залита
 * картинками, а не PDF).
 * ─────────────────────────────────────────────────────────────────
 */
export function canViewInline(kind: MediaKind): boolean {
  return kind === 'pdf' || kind === 'image'
}
