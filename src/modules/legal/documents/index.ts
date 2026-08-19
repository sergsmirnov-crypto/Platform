import { contactsDocument } from './contacts'
import { offerDocument } from './offer'
import { privacyDocument } from './privacy'

import type { AcceptableDocumentId, LegalDocument, LegalDocumentId } from '../types'

/**
 * Реестр правовых документов.
 *
 * Единственное место, откуда их берут страницы и сервис согласий.
 * Порядок в `LEGAL_DOCUMENT_ORDER` — порядок в навигации: сначала то,
 * с чем соглашаются, потом справочное.
 */
export const LEGAL_DOCUMENTS: Record<LegalDocumentId, LegalDocument> = {
  offer: offerDocument,
  privacy: privacyDocument,
  contacts: contactsDocument,
}

export const LEGAL_DOCUMENT_ORDER: LegalDocumentId[] = ['offer', 'privacy', 'contacts']

export function getLegalDocument(id: LegalDocumentId): LegalDocument {
  return LEGAL_DOCUMENTS[id]
}

/**
 * Документы, требующие согласия.
 *
 * Считается из самих документов, а не задаётся вторым списком: два списка
 * однажды разойдутся, и платформа начнёт требовать согласия с тем, чего
 * человеку не показала.
 */
export function acceptableDocuments(): LegalDocument[] {
  return LEGAL_DOCUMENT_ORDER.map((id) => LEGAL_DOCUMENTS[id]).filter(
    (document) => document.requiresAcceptance,
  )
}

export function isAcceptableDocumentId(id: LegalDocumentId): id is AcceptableDocumentId {
  return LEGAL_DOCUMENTS[id].requiresAcceptance
}
