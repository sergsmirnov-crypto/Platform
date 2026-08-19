import { routes } from '@/shared/routes'

import { LEGAL_DOCUMENT_ORDER, LEGAL_DOCUMENTS } from '../documents'
import { fillPlaceholders } from '../placeholders'
import { legalStrings } from '../strings'

import { LegalBody } from './legal-body'

import type { PlaceholderKey, PlaceholderValues } from '../placeholders'
import type { LegalDocument, LegalDocumentId } from '../types'

/**
 * Страница правового документа.
 *
 * Один компонент на все три документа: они отличаются только текстом,
 * и три почти одинаковых страницы разошлись бы в оформлении за первый же
 * год. Данные приходят готовыми — компонент ничего не читает сам.
 */
export function LegalDocumentView({
  document,
  values,
  unfilled,
  showUnfilledWarning,
}: {
  document: LegalDocument
  values: PlaceholderValues
  /** Незаполненные реквизиты. Считаются на сервере */
  unfilled: PlaceholderKey[]
  /** Показывать ли предупреждение: только тем, кто может это исправить */
  showUnfilledWarning: boolean
}) {
  const text = fillPlaceholders(document.body, values)

  return (
    <article className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="border-border border-b pb-6">
        <a href={routes.home()} className="text-content-muted text-sm underline">
          {legalStrings.document.backToPlatform}
        </a>

        <h1 className="mt-5 text-2xl font-bold sm:text-3xl">{document.title}</h1>
        <p className="text-content-muted mt-2 text-sm">{document.summary}</p>

        <p className="text-content-subtle mt-4 text-xs">
          {legalStrings.document.version(document.version)} ·{' '}
          {legalStrings.document.effectiveFrom(formatEffectiveDate(document.effectiveDate))}
        </p>
      </header>

      {showUnfilledWarning && unfilled.length > 0 ? (
        <aside className="border-danger text-danger mt-6 rounded border px-4 py-3 text-sm">
          <p className="font-medium">{legalStrings.unfilled.title}</p>
          <p className="mt-1 opacity-90">{legalStrings.unfilled.description}</p>
          <p className="mt-2 text-xs opacity-75">{legalStrings.unfilled.keys(unfilled.length)}</p>
        </aside>
      ) : null}

      <div className="mt-8">
        <LegalBody markdown={text} />
      </div>

      <LegalDocumentNav current={document.id} />
    </article>
  )
}

/**
 * Переходы между документами.
 *
 * Внизу, а не сверху: наверху страницы человеку нужен документ, а не список
 * документов. Ссылка на текущий не показывается — она бы никуда не вела.
 */
function LegalDocumentNav({ current }: { current: LegalDocumentId }) {
  const others = LEGAL_DOCUMENT_ORDER.filter((id) => id !== current)

  return (
    <nav className="border-border mt-12 border-t pt-6">
      <p className="text-content-subtle text-xs">{legalStrings.document.otherDocuments}</p>
      <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {others.map((id) => (
          <li key={id}>
            <a href={legalHref(id)} className="underline">
              {LEGAL_DOCUMENTS[id].shortTitle}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function legalHref(id: LegalDocumentId): string {
  if (id === 'offer') return routes.legal.offer()
  if (id === 'privacy') return routes.legal.privacy()
  return routes.legal.contacts()
}

/** `2026-08-17` → `17.08.2026`. В документе привычнее видеть русский формат */
function formatEffectiveDate(value: string): string {
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}.${month}.${year}` : value
}
