import { getViewer, viewerCan } from '@/app/app/_lib/viewer'
import { getLegalDocument, LegalDocumentView } from '@/modules/legal'
import type { LegalDocumentId } from '@/modules/legal'
import { legalValues, unfilledLegalValues } from '@/modules/legal/service'

/**
 * Сборка страницы правового документа.
 *
 * Три страницы отличаются одним значением, поэтому вся серверная часть —
 * чтение реквизитов и проверка права — живёт здесь, а сами страницы
 * остаются в три строки. Иначе один и тот же код с проверкой прав
 * пришлось бы поддерживать в трёх местах, и однажды в одном из них
 * он бы отстал.
 *
 * Страницы публичные: сессии может не быть вовсе, и это нормальный случай,
 * а не ошибка. Документы обязаны читаться до входа — иначе согласиться
 * с ними невозможно.
 *
 * Права спрашиваются через `getViewer`, как и во всей платформе, хотя зона
 * здесь публичная. Причина не в формальном соблюдении правила: куратор,
 * включивший режим «смотреть как участник», обязан увидеть страницу ровно
 * такой, какой её видит участник, — то есть без предупреждения
 * о незаполненных реквизитах. Обращение к правам напрямую этот режим
 * бы не учло.
 */
export async function renderLegalPage(id: LegalDocumentId) {
  const document = getLegalDocument(id)
  const values = legalValues()
  const unfilled = unfilledLegalValues()

  const viewer = await getViewer()

  return (
    <LegalDocumentView
      document={document}
      values={values}
      unfilled={unfilled}
      showUnfilledWarning={viewerCan(viewer, 'settings.edit')}
    />
  )
}
