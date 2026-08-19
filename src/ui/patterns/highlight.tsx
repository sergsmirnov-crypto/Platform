import { Fragment } from 'react'

/**
 * Подсветка найденных слов.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ПОДСВЕЧИВАЕМ В БРАУЗЕРЕ, А НЕ В БАЗЕ
 *
 * У PostgreSQL есть `ts_headline` — он умеет возвращать текст с уже
 * расставленной разметкой. Пользоваться им мы не будем: это готовый
 * HTML, пришедший из базы, и вставить его в страницу можно только
 * через `dangerouslySetInnerHTML`. Заводить такую дверь ради жёлтой
 * заливки — плохой размен, даже когда содержимое сейчас безопасно.
 *
 * Здесь текст остаётся текстом, а разметку строит React.
 * ─────────────────────────────────────────────────────────────────
 *
 * Подсвечивается фирменным маркером — тем же приёмом, что индикатор
 * прохождения разбора. Приём из логотипа работает и как украшение,
 * и как указание: глаз сразу находит, за что зацепился поиск.
 */

type HighlightProps = {
  text: string
  /** Слова в нижнем регистре. Пустой список — просто текст */
  terms: string[]
}

export function Highlight({ text, terms }: HighlightProps) {
  const parts = splitByTerms(text, terms)

  if (parts.length === 1) return <>{text}</>

  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {part.matched ? (
            <mark className="marker-highlight bg-transparent">{part.text}</mark>
          ) : (
            part.text
          )}
        </Fragment>
      ))}
    </>
  )
}

type Part = { text: string; matched: boolean }

/**
 * Делит текст на совпавшие и не совпавшие куски.
 *
 * Ищется начало слова, а не любое вхождение: подсветка «ка» внутри
 * «Пачка» там, где человек искал «Кино», выглядит как ошибка. Именно
 * так же работает и сам поиск — совпадением считается начало слова.
 */
function splitByTerms(text: string, terms: string[]): Part[] {
  const usable = terms.filter((term) => term.length >= 2)
  if (usable.length === 0) return [{ text, matched: false }]

  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(${usable.map(escape).join('|')})`, 'giu')
  const parts: Part[] = []

  let cursor = 0

  for (const match of text.matchAll(pattern)) {
    const start = match.index
    const found = match[0]

    if (start > cursor) parts.push({ text: text.slice(cursor, start), matched: false })

    parts.push({ text: found, matched: true })
    cursor = start + found.length
  }

  if (cursor < text.length) parts.push({ text: text.slice(cursor), matched: false })

  return parts.length > 0 ? parts : [{ text, matched: false }]
}

/** Слово из запроса попадает в регулярное выражение — знаки обезвреживаются */
function escape(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
