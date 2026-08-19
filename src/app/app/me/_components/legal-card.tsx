import { LEGAL_DOCUMENTS, LEGAL_DOCUMENT_ORDER, legalStrings } from '@/modules/legal'
import type { LegalDocumentId } from '@/modules/legal'
import { routes } from '@/shared/routes'
import { Card, CardBody, CardTitle } from '@/ui'

/**
 * Ссылки на правовые документы в настройках.
 *
 * Зачем они здесь, если оферта уже есть на странице входа: человек,
 * вошедший год назад, страницу входа больше не видит. Между тем именно
 * ему однажды понадобится вспомнить условия возврата или узнать, куда
 * писать об удалении данных. Ссылка «где-то на лендинге» этой задачи
 * не решает.
 *
 * Рядом с номером редакции — она отвечает на вопрос «а условия
 * не поменялись?» без чтения всего документа.
 */
export function LegalCard() {
  return (
    <Card>
      <CardBody>
        <CardTitle>{legalStrings.section.title}</CardTitle>
        <p className="text-content-muted mt-1 mb-4 text-sm">{legalStrings.section.description}</p>

        <ul className="space-y-2 text-sm">
          {LEGAL_DOCUMENT_ORDER.map((id) => {
            const document = LEGAL_DOCUMENTS[id]

            return (
              <li
                key={id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
              >
                <a href={legalHref(id)} className="underline">
                  {document.title}
                </a>
                <span className="text-content-subtle text-xs">
                  {legalStrings.document.version(document.version)}
                </span>
              </li>
            )
          })}
        </ul>
      </CardBody>
    </Card>
  )
}

function legalHref(id: LegalDocumentId): string {
  if (id === 'offer') return routes.legal.offer()
  if (id === 'privacy') return routes.legal.privacy()
  return routes.legal.contacts()
}
