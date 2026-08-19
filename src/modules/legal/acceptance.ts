import type { AcceptableDocumentId, AcceptedVersion, LegalDocument } from './types'

/**
 * Правила согласия с документами.
 *
 * Чистые функции: на вход — что требуется и что человек уже подписал,
 * на выход — чего не хватает. Ни базы, ни настроек, поэтому всё это
 * проверяется тестом целиком, а не по частям с подделкой запросов.
 */

/**
 * Достаточно ли согласия для этого документа.
 *
 * Сравнение «не меньше», а не «ровно»: если редакцию когда-нибудь придётся
 * откатить (юрист нашёл ошибку в новой формулировке, вернулись к прежней),
 * человек, согласившийся с более поздней редакцией, не должен получить
 * экран согласия заново. Строгое равенство отправило бы на повторное
 * согласие всех, кто аккуратнее остальных.
 */
export function isSatisfied(document: LegalDocument, accepted: AcceptedVersion[]): boolean {
  if (!document.requiresAcceptance) return true

  return accepted.some(
    (record) => record.document === document.id && record.version >= document.version,
  )
}

/**
 * С чем человеку осталось согласиться.
 *
 * Пустой список означает «всё в порядке» — именно на него смотрит
 * онбординг, решая, показывать ли экран согласия.
 */
export function missingAcceptances(
  documents: LegalDocument[],
  accepted: AcceptedVersion[],
): AcceptableDocumentId[] {
  return documents
    .filter((document) => document.requiresAcceptance && !isSatisfied(document, accepted))
    .map((document) => document.id as AcceptableDocumentId)
}

/**
 * Когда человек согласился с действующей редакцией документа.
 *
 * Нужно карточке участника в разделе «Управление»: на вопрос «а он вообще
 * соглашался с офертой» должен быть ответ с датой, а не «да».
 */
export function acceptedAt(document: LegalDocument, accepted: AcceptedVersion[]): Date | null {
  const matching = accepted
    .filter((record) => record.document === document.id && record.version >= document.version)
    .sort((left, right) => left.acceptedAt.getTime() - right.acceptedAt.getTime())

  return matching[0]?.acceptedAt ?? null
}
