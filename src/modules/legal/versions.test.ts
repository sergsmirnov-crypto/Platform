import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { LEGAL_DOCUMENTS, LEGAL_DOCUMENT_ORDER } from './documents'
import { DOCUMENT_CHECKSUMS } from './documents/checksums'
import { LEGAL_DOCUMENT_IDS } from './types'

/**
 * Защита правовых документов от молчаливой правки.
 *
 * Если этот тест упал — вы изменили текст документа. Это нормально
 * и, вероятно, именно то, что вы хотели. Порядок действий:
 *
 *   1. увеличьте `version` в самом документе;
 *   2. запустите `pnpm legal:checksums`;
 *   3. перенесите новые значения в `documents/checksums.ts`.
 *
 * Почему нельзя просто обновить сумму, не меняя номер: записи о согласии
 * ссылаются на номер редакции. Оставив прежний номер, вы получите полторы
 * сотни записей «согласился с редакцией 2», указывающих на текст, которого
 * участники не видели. Подробности — в `documents/checksums.ts`.
 */
describe('правовые документы', () => {
  it('реестр содержит все документы и ни одного лишнего', () => {
    expect(LEGAL_DOCUMENT_ORDER.slice().sort()).toEqual(LEGAL_DOCUMENT_IDS.slice().sort())
    expect(Object.keys(LEGAL_DOCUMENTS).sort()).toEqual(LEGAL_DOCUMENT_IDS.slice().sort())
  })

  for (const id of LEGAL_DOCUMENT_IDS) {
    const document = LEGAL_DOCUMENTS[id]

    describe(`«${document.title}»`, () => {
      it('идентификатор совпадает с ключом в реестре', () => {
        expect(document.id).toBe(id)
      })

      it('номер редакции — целое положительное число', () => {
        expect(Number.isInteger(document.version)).toBe(true)
        expect(document.version).toBeGreaterThanOrEqual(1)
      })

      it('дата вступления в силу задана как ГГГГ-ММ-ДД и разбирается', () => {
        expect(document.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(Number.isNaN(new Date(document.effectiveDate).getTime())).toBe(false)
      })

      it('текст не пустой и содержит заголовки разделов', () => {
        expect(document.body.length).toBeGreaterThan(200)
        expect(document.body).toContain('## ')
      })

      it('контрольная сумма относится к действующей редакции', () => {
        expect(DOCUMENT_CHECKSUMS[id].version).toBe(document.version)
      })

      it('текст не менялся без смены редакции', () => {
        const actual = createHash('sha256').update(document.body, 'utf8').digest('hex')
        expect(actual).toBe(DOCUMENT_CHECKSUMS[id].sha256)
      })
    })
  }

  it('согласия требуют ровно оферта и политика', () => {
    const acceptable = LEGAL_DOCUMENT_ORDER.filter((id) => LEGAL_DOCUMENTS[id].requiresAcceptance)
    expect(acceptable).toEqual(['offer', 'privacy'])
  })
})
