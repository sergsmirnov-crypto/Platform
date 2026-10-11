import { z } from 'zod'

/**
 * Формат блочного содержимого.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ В ОБЩЕМ СЛОЕ
 *
 * Появился на шаге 6.2 как «содержимое урока» и переехал сюда
 * на шаге 10.7, когда тот же формат понадобился новостям клуба.
 * Набор блоков — заголовок, абзац, список, совет, аккорды, картинка —
 * не бизнес-правило курса, а способ хранить текст.
 *
 * Оставить его в курсе, а новостям обращаться к курсу, было нельзя:
 * модуль не знает о других модулях. Тот же переезд, что у таймкодов
 * (10.2) и разбора поискового запроса (10.4).
 * ─────────────────────────────────────────────────────────────────
 *
 * ─────────────────────────────────────────────────────────────────
 * СПИСОК БЛОКОВ, А НЕ ТЕКСТ ИЗ РЕДАКТОРА
 *
 * Напрашивающееся решение — взять готовый редактор (TipTap, Lexical)
 * и хранить его дерево. Отвергнуто:
 *
 *   • формат тогда принадлежит им и меняется с их версиями;
 *   • отрисовывать его всё равно пришлось бы самим — либо принимать
 *     из базы готовый HTML, чего мы не делаем нигде;
 *   • куратор получает свободу напечатать кашу из шрифтов и отступов,
 *     а платформа — сто килобайт кода в браузере у трёх человек.
 *
 * Здесь набор видов блоков закрыт. Форматирование достигается выбором
 * вида, а не разметкой внутри текста. Подробно — ADR-0018.
 * ─────────────────────────────────────────────────────────────────
 *
 * ЗАЧЕМ ПРОВЕРЯТЬ ТО, ЧТО САМИ ЖЕ ЗАПИСАЛИ
 *
 * Потому что записали это в прошлом году, другой версией приложения,
 * а может быть — руками в базе при переносе. JSON в базе не имеет
 * типа: TypeScript уверен, что там `ContentBlocks`, а лежать может
 * что угодно. Непроверенное чтение падает не при записи, а через
 * полгода, на странице у участника.
 *
 * Поэтому чтение всегда идёт через `parseContentBlocks`, а неизвестные
 * и испорченные блоки молча выбрасываются: урок с одним пропавшим
 * абзацем лучше пустой страницы с ошибкой.
 */

/** Заголовок внутри урока */
const headingBlock = z.object({
  type: z.literal('heading'),
  text: z.string().min(1).max(200),
})

/** Обычный абзац. Выделения внутри текста нет — см. ADR-0018 */
const paragraphBlock = z.object({
  type: z.literal('paragraph'),
  text: z.string().min(1).max(4000),
})

/** Список: нумерованный или простой */
const listBlock = z.object({
  type: z.literal('list'),
  ordered: z.boolean().default(false),
  items: z.array(z.string().min(1).max(500)).min(1).max(30),
})

/** Врезка-совет: то, что куратор говорит голосом «а вот здесь осторожно» */
const tipBlock = z.object({
  type: z.literal('tip'),
  text: z.string().min(1).max(1000),
  tone: z.enum(['tip', 'warning']).default('tip'),
})

/**
 * Аккорды.
 *
 * Отдельный вид, а не абзац моноширинным шрифтом: аккордовую сетку
 * нужно показывать без переносов и с сохранением пробелов, а на телефоне
 * — с горизонтальной прокруткой вместо превращения в кашу.
 */
const chordsBlock = z.object({
  type: z.literal('chords'),
  text: z.string().min(1).max(2000),
  caption: z.string().max(200).nullable().default(null),
})

/** Картинка: схема, снимок грифа, фотография постановки руки */
const imageBlock = z.object({
  type: z.literal('image'),
  assetId: z.uuid(),
  caption: z.string().max(200).nullable().default(null),
})

/** Дополнительное видео внутри урока — помимо основного ролика */
const videoBlock = z.object({
  type: z.literal('video'),
  assetId: z.uuid(),
  caption: z.string().max(200).nullable().default(null),
})

/**
 * Связанный разбор.
 *
 * Не ссылка строкой, а привязка к песне по идентификатору. Даёт
 * «после этого урока попробуй вот это» из PRD и — что важнее — не
 * превращается в битую ссылку, когда у песни поменяется адрес.
 */
const songLinkBlock = z.object({
  type: z.literal('song'),
  songId: z.uuid(),
  note: z.string().max(300).nullable().default(null),
})

export const contentBlockSchema = z.discriminatedUnion('type', [
  headingBlock,
  paragraphBlock,
  listBlock,
  tipBlock,
  chordsBlock,
  imageBlock,
  videoBlock,
  songLinkBlock,
])

export type ContentBlock = z.infer<typeof contentBlockSchema>
export type ContentBlockType = ContentBlock['type']

/** Сколько блоков помещается в один урок. Больше — это уже не урок, а модуль */
export const MAX_BLOCKS = 200

export const contentBlocksSchema = z.array(contentBlockSchema).max(MAX_BLOCKS)

export type ContentBlocks = ContentBlock[]

/**
 * Читает содержимое урока из базы.
 *
 * Never throws: испорченный блок выбрасывается, а урок показывается.
 * Обратное поведение — уронить страницу из-за одной кривой записи —
 * означало бы, что ошибка переноса, сделанная год назад, сегодня
 * ломает занятие человеку.
 */
export function parseContentBlocks(raw: unknown): ContentBlocks {
  if (!Array.isArray(raw)) return []

  const blocks: ContentBlocks = []

  for (const candidate of raw) {
    const parsed = contentBlockSchema.safeParse(candidate)
    if (parsed.success) blocks.push(parsed.data)
  }

  return blocks.slice(0, MAX_BLOCKS)
}

/** Виды блоков, ссылающиеся на файлы: нужно знать, что подгружать к уроку */
export function collectAssetIds(content: ContentBlocks): string[] {
  const ids = content
    .filter((block) => block.type === 'image' || block.type === 'video')
    .map((block) => block.assetId)

  return [...new Set(ids)]
}

/** Разборы, упомянутые в уроке */
export function collectSongIds(content: ContentBlocks): string[] {
  const ids = content.filter((block) => block.type === 'song').map((block) => block.songId)

  return [...new Set(ids)]
}

/**
 * Есть ли в уроке текст помимо видео.
 *
 * Карта курса показывает разные значки для «посмотреть» и «почитать»,
 * а страница урока не рисует пустой блок содержимого.
 */
export function hasReadableContent(content: ContentBlocks): boolean {
  return content.some((block) => block.type !== 'image' && block.type !== 'video')
}
