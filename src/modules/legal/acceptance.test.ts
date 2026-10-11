import { describe, expect, it } from 'vitest'

import { acceptedAt, isSatisfied, missingAcceptances } from './acceptance'

import type { AcceptedVersion, LegalDocument } from './types'

function document(overrides: Partial<LegalDocument> = {}): LegalDocument {
  return {
    id: 'offer',
    title: 'Оферта',
    shortTitle: 'Оферта',
    summary: '',
    version: 2,
    effectiveDate: '2026-01-01',
    requiresAcceptance: true,
    body: '',
    ...overrides,
  }
}

function accepted(version: number, at = '2026-03-12T10:00:00Z'): AcceptedVersion {
  return { document: 'offer', version, acceptedAt: new Date(at) }
}

describe('isSatisfied', () => {
  it('согласие с действующей редакцией годится', () => {
    expect(isSatisfied(document(), [accepted(2)])).toBe(true)
  })

  it('согласие с прежней редакцией не годится', () => {
    expect(isSatisfied(document(), [accepted(1)])).toBe(false)
  })

  it('согласие с более поздней редакцией годится: откат редакции не должен спрашивать заново', () => {
    expect(isSatisfied(document(), [accepted(3)])).toBe(true)
  })

  it('без согласий не годится', () => {
    expect(isSatisfied(document(), [])).toBe(false)
  })

  it('согласие с другим документом не подходит', () => {
    const privacy = document({ id: 'privacy' })
    expect(isSatisfied(privacy, [accepted(2)])).toBe(false)
  })

  it('документ без требования согласия удовлетворён всегда', () => {
    const contacts = document({ id: 'contacts', requiresAcceptance: false })
    expect(isSatisfied(contacts, [])).toBe(true)
  })
})

describe('missingAcceptances', () => {
  const offer = document({ id: 'offer', version: 1 })
  const privacy = document({ id: 'privacy', version: 1 })
  const contacts = document({ id: 'contacts', requiresAcceptance: false })

  it('перечисляет только то, чего не хватает', () => {
    const records: AcceptedVersion[] = [{ ...accepted(1), document: 'offer' }]
    expect(missingAcceptances([offer, privacy, contacts], records)).toEqual(['privacy'])
  })

  it('на полном наборе согласий пусто', () => {
    const records: AcceptedVersion[] = [
      { ...accepted(1), document: 'offer' },
      { ...accepted(1), document: 'privacy' },
    ]
    expect(missingAcceptances([offer, privacy, contacts], records)).toEqual([])
  })

  it('справочные документы в список не попадают никогда', () => {
    expect(missingAcceptances([contacts], [])).toEqual([])
  })
})

describe('acceptedAt', () => {
  it('возвращает самое раннее подходящее согласие', () => {
    const records = [accepted(3, '2026-05-01T00:00:00Z'), accepted(2, '2026-04-01T00:00:00Z')]

    expect(acceptedAt(document(), records)?.toISOString()).toBe('2026-04-01T00:00:00.000Z')
  })

  it('без подходящего согласия возвращает null', () => {
    expect(acceptedAt(document(), [accepted(1)])).toBeNull()
  })
})
