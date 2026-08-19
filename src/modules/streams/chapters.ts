/**
 * Правила оглавления.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОРЯДОК ЗАДАЁТ ВРЕМЯ, А НЕ КУРАТОР
 *
 * У частей разбора порядок ставит человек: «сначала вступление, потом
 * куплет» — это его решение. У оглавления записи решать нечего: пункт
 * на сорок седьмой минуте идёт после пункта на двенадцатой, и никак
 * иначе.
 *
 * Поэтому здесь нет перетаскивания. Куратор вписывает пункты в любом
 * порядке — как вспомнил, отматывая запись, — а список выстраивается
 * сам. Это заметно быстрее: не надо ни вставлять строку в середину,
 * ни двигать её потом.
 * ─────────────────────────────────────────────────────────────────
 *
 * Ни базы, ни сети — отсюда и тесты. Ошибка здесь означает, что
 * участник нажимает «Соло» и попадает на приветствие.
 */

export type ChapterDraft = {
  title: string
  startSec: number
}

export type NormalizedChapter = ChapterDraft & {
  orderIndex: number
}

/**
 * Приведение списка к тому виду, в котором он ложится в базу.
 *
 * Что делает:
 *   · выбрасывает пункты без названия — пустая строка в оглавлении
 *     бесполезна, а куратор добавляет строку до того, как печатает;
 *   · выстраивает по времени;
 *   · оставляет один пункт на секунду: два названия для одного мгновения
 *     означают опечатку, и побеждает первый — тот, что куратор вписал
 *     раньше, обычно правильный;
 *   · проставляет порядковые номера подряд, без дыр.
 */
export function normalizeChapters(chapters: ChapterDraft[]): NormalizedChapter[] {
  const filled = chapters
    .map((chapter) => ({ title: chapter.title.trim(), startSec: Math.max(0, chapter.startSec) }))
    .filter((chapter) => chapter.title.length > 0)

  const sorted = [...filled].sort((left, right) => left.startSec - right.startSec)

  const unique: ChapterDraft[] = []

  for (const chapter of sorted) {
    if (unique.some((existing) => existing.startSec === chapter.startSec)) continue
    unique.push(chapter)
  }

  return unique.map((chapter, index) => ({ ...chapter, orderIndex: index }))
}

/**
 * Что не так с оглавлением — для подсказки в редакторе.
 *
 * Сообщения показываются рядом с полем, а не после нажатия «Сохранить»:
 * куратор вписывает пункты подряд и должен видеть опечатку сразу.
 *
 * Заметьте, чего здесь нет: требования, чтобы таймкод укладывался
 * в длительность записи. Длительность мы узнаём от видеохостинга и не
 * всегда вовремя, а запретить сохранение из-за неизвестного нам числа —
 * худший вид строгости.
 */
export type ChapterIssue = {
  index: number
  message: string
}

export function findChapterIssues(
  chapters: { title: string; startSec: number | null }[],
): ChapterIssue[] {
  // prettier-ignore
  const issues: ChapterIssue[] = []
  const seen = new Map<number, number>()

  chapters.forEach((chapter, index) => {
    const hasTitle = chapter.title.trim().length > 0

    if (hasTitle && chapter.startSec === null) {
      issues.push({ index, message: 'Укажите время, например 12:30' })
      return
    }

    if (!hasTitle && chapter.startSec !== null) {
      issues.push({ index, message: 'Пункт без названия не сохранится' })
      return
    }

    if (chapter.startSec === null) return

    const first = seen.get(chapter.startSec)

    if (first !== undefined) {
      issues.push({ index, message: `Это же время уже занято пунктом ${first + 1}` })
      return
    }

    seen.set(chapter.startSec, index)
  })

  return issues
}
