/**
 * Печатает контрольные суммы правовых документов.
 *
 * Нужен после правки текста: тест `versions.test.ts` упадёт, и здесь
 * берутся новые значения для `documents/checksums.ts`. Не забудьте
 * увеличить номер редакции — сумма без нового номера смысла не имеет.
 *
 * Запуск: pnpm legal:checksums
 */
import { createHash } from 'node:crypto'

import { LEGAL_DOCUMENTS, LEGAL_DOCUMENT_ORDER } from '@/modules/legal/documents'

for (const id of LEGAL_DOCUMENT_ORDER) {
  const document = LEGAL_DOCUMENTS[id]
  const sha256 = createHash('sha256').update(document.body, 'utf8').digest('hex')

  console.log(`${id}:`)
  console.log(`  version: ${document.version},`)
  console.log(`  sha256: '${sha256}',`)
}
