/**
 * Публичный вход модуля правовых документов.
 *
 * Наружу отдаются документы, чистые правила и компонент страницы.
 * Всё, что ходит в базу, живёт в `service.ts` и подключается оттуда
 * напрямую — так видно, какая страница действительно читает данные.
 */

export {
  acceptableDocuments,
  getLegalDocument,
  isAcceptableDocumentId,
  LEGAL_DOCUMENTS,
  LEGAL_DOCUMENT_ORDER,
} from './documents'

export { acceptedAt, isSatisfied, missingAcceptances } from './acceptance'

export {
  fillPlaceholders,
  findPlaceholders,
  PLACEHOLDER_KEYS,
  UNFILLED_MARK,
  unfilledPlaceholders,
} from './placeholders'
export type { PlaceholderKey, PlaceholderValues } from './placeholders'

export { legalStrings } from './strings'

export { LegalDocumentView } from './components/legal-document-view'

export { legalAcceptances } from './schema'

export { LEGAL_DOCUMENT_IDS } from './types'
export type { AcceptableDocumentId, AcceptedVersion, LegalDocument, LegalDocumentId } from './types'
