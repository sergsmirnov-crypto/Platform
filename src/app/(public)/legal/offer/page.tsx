import { LEGAL_DOCUMENTS } from '@/modules/legal'

import { renderLegalPage } from '../_lib/render-legal-page'

export const metadata = { title: LEGAL_DOCUMENTS.offer.title }

export default async function OfferPage() {
  return renderLegalPage('offer')
}
