import { describe, expect, it } from 'vitest'

import {
  belongsToClub,
  interpretToolsyEvent,
  isToolsyActive,
  readToolsySubscription,
} from './toolsy'

/**
 * Разбор уведомлений Toolsy. Цена ошибки прямая: неверно истолкованное
 * событие отбирает доступ у человека, который заплатил, или дарит его
 * тому, кто не платил.
 */

const CLUB_PRODUCT = 'prod_club'

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub_1',
    status: 'active',
    startedAt: '2026-10-01T10:00:00.000Z',
    expiredAt: '2026-11-01T10:00:00.000Z',
    isInfinite: false,
    updatedAt: '2026-10-01T10:00:05.000Z',
    visit: { client: { tgId: '123456789' }, project: { id: 'proj_1' } },
    latestInvoice: { subscriptionPlan: { product: { id: CLUB_PRODUCT } } },
    ...overrides,
  }
}

function event(type: string, data: unknown = subscription()) {
  return { id: 'arq_1', type, data }
}

describe('readToolsySubscription', () => {
  it('достаёт всё нужное платформе', () => {
    expect(readToolsySubscription(subscription())).toEqual({
      subscriptionId: 'sub_1',
      telegramId: '123456789',
      status: 'active',
      expiresAt: new Date('2026-11-01T10:00:00.000Z'),
      productId: CLUB_PRODUCT,
      sourceUpdatedAt: new Date('2026-10-01T10:00:05.000Z'),
    })
  })

  it('не принимает подписку без Telegram ID: сопоставить её не с кем', () => {
    expect(readToolsySubscription(subscription({ visit: { client: { tgId: null } } }))).toBeNull()
    expect(readToolsySubscription(subscription({ visit: null }))).toBeNull()
  })

  it('не принимает подписку без идентификатора или состояния', () => {
    expect(readToolsySubscription(subscription({ id: '' }))).toBeNull()
    expect(readToolsySubscription(subscription({ status: undefined }))).toBeNull()
  })

  it('принимает Telegram ID числом', () => {
    const fact = readToolsySubscription(subscription({ visit: { client: { tgId: 987 } } }))

    expect(fact?.telegramId).toBe('987')
  })

  it('приводит состояние к нижнему регистру', () => {
    expect(readToolsySubscription(subscription({ status: 'ACTIVE' }))?.status).toBe('active')
  })

  it('не падает на испорченных датах и отсутствии продукта', () => {
    const fact = readToolsySubscription(
      subscription({ expiredAt: 'вчера', updatedAt: null, latestInvoice: null }),
    )

    expect(fact?.expiresAt).toBeNull()
    expect(fact?.sourceUpdatedAt).toBeNull()
    expect(fact?.productId).toBeNull()
  })

  it.each([null, undefined, 'строка', 42, []])('не принимает не-объект: %s', (raw) => {
    expect(readToolsySubscription(raw)).toBeNull()
  })
})

describe('isToolsyActive', () => {
  it('даёт доступ действующей подписке', () => {
    expect(isToolsyActive('active')).toBe(true)
  })

  it('сохраняет доступ, пока Toolsy повторяет неудачное списание', () => {
    expect(isToolsyActive('delayed')).toBe(true)
  })

  it.each(['expired', 'canceled', 'missing', 'что-то новое'])('не даёт доступ: %s', (status) => {
    expect(isToolsyActive(status)).toBe(false)
  })
})

describe('belongsToClub', () => {
  it('принимает любой продукт, если продукт клуба не указан', () => {
    expect(belongsToClub({ productId: 'prod_other' }, undefined)).toBe(true)
  })

  it('отсекает подписку на другой продукт', () => {
    expect(belongsToClub({ productId: 'prod_other' }, CLUB_PRODUCT)).toBe(false)
  })

  it('принимает подписку с неизвестным продуктом: лучше открыть, чем закрыть оплатившему', () => {
    expect(belongsToClub({ productId: null }, CLUB_PRODUCT)).toBe(true)
  })
})

describe('interpretToolsyEvent', () => {
  it.each(['subscription.created', 'subscription.updated', 'subscription.canceled'])(
    'принимает событие о подписке: %s',
    (type) => {
      const verdict = interpretToolsyEvent(event(type), CLUB_PRODUCT)

      expect(verdict.kind).toBe('subscription')
      if (verdict.kind === 'subscription') {
        expect(verdict.eventType).toBe(type)
        expect(verdict.eventId).toBe('arq_1')
        expect(verdict.fact.telegramId).toBe('123456789')
      }
    },
  )

  it('передаёт состояние отменённой подписки как есть', () => {
    const verdict = interpretToolsyEvent(
      event('subscription.canceled', subscription({ status: 'canceled' })),
      CLUB_PRODUCT,
    )

    expect(verdict.kind === 'subscription' && verdict.fact.status).toBe('canceled')
  })

  it.each(['payment.created', 'refund.created', 'visit.created', 'billing-plan.updated'])(
    'пропускает событие, не меняющее подписку: %s',
    (type) => {
      expect(interpretToolsyEvent(event(type), CLUB_PRODUCT).kind).toBe('ignored')
    },
  )

  it('пропускает подписку на другой продукт', () => {
    const other = subscription({
      latestInvoice: { subscriptionPlan: { product: { id: 'prod_course' } } },
    })

    expect(interpretToolsyEvent(event('subscription.created', other), CLUB_PRODUCT).kind).toBe(
      'ignored',
    )
  })

  it('пропускает событие без Telegram ID', () => {
    const anonymous = subscription({ visit: { client: {} } })

    expect(interpretToolsyEvent(event('subscription.created', anonymous), null).kind).toBe(
      'ignored',
    )
  })

  it.each([null, {}, { type: 42 }, 'subscription.created'])(
    'пропускает то, что не похоже на уведомление: %s',
    (body) => {
      expect(interpretToolsyEvent(body, null).kind).toBe('ignored')
    },
  )
})
