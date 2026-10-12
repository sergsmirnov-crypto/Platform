import { describe, expect, it } from 'vitest'

import { applyEvent, daysUntilLoss, grantsAccess } from './entitlement-policy'

import type { EntitlementState } from './entitlement-policy'

/**
 * Ошибка в этом автомате означает одно из двух: человек потерял оплаченный
 * доступ или получил его бесплатно. Оба случая обнаруживаются не разработчиком,
 * а участником клуба — поэтому переходы проверяются здесь целиком.
 */

const NOW = new Date('2026-08-07T12:00:00Z')
const GRACE_DAYS = 7
const options = { graceDays: GRACE_DAYS, now: NOW }
const days = (n: number) => n * 24 * 60 * 60 * 1000

const state = (overrides: Partial<EntitlementState> = {}): EntitlementState => ({
  status: 'none',
  source: null,
  validUntil: null,
  graceUntil: null,
  ...overrides,
})

describe('grantsAccess', () => {
  it('даёт доступ при активной подписке и в льготном периоде', () => {
    expect(grantsAccess('active')).toBe(true)
    expect(grantsAccess('grace')).toBe(true)
  })

  it('не даёт доступ без подписки и после истечения', () => {
    expect(grantsAccess('none')).toBe(false)
    expect(grantsAccess('expired')).toBe(false)
  })
})

describe('оплата подтверждена', () => {
  it('открывает доступ новому человеку', () => {
    const { next, changed } = applyEvent(
      state(),
      { type: 'paid_confirmed', source: 'telegram_channel' },
      options,
    )

    expect(next.status).toBe('active')
    expect(next.source).toBe('telegram_channel')
    expect(changed).toBe(true)
  })

  it('возвращает доступ из льготного периода и убирает его срок', () => {
    const current = state({
      status: 'grace',
      source: 'telegram_channel',
      graceUntil: new Date(NOW.getTime() + days(3)),
    })

    const { next } = applyEvent(
      current,
      { type: 'paid_confirmed', source: 'telegram_channel' },
      options,
    )

    expect(next.status).toBe('active')
    expect(next.graceUntil).toBeNull()
  })

  it('возвращает доступ тому, у кого он истёк', () => {
    const current = state({ status: 'expired', source: 'telegram_channel' })

    expect(
      applyEvent(current, { type: 'paid_confirmed', source: 'telegram_channel' }, options).next
        .status,
    ).toBe('active')
  })

  it('не считает изменением повторное событие о том же', () => {
    const current = state({ status: 'active', source: 'telegram_channel' })

    // Telegram может прислать одно событие дважды — лишней записи в базу быть не должно
    expect(
      applyEvent(current, { type: 'paid_confirmed', source: 'telegram_channel' }, options).changed,
    ).toBe(false)
  })

  it('не перезаписывает ручную выдачу', () => {
    const validUntil = new Date(NOW.getTime() + days(30))
    const current = state({ status: 'active', source: 'manual', validUntil })

    const { next } = applyEvent(
      current,
      { type: 'paid_confirmed', source: 'telegram_channel' },
      options,
    )

    expect(next.source).toBe('manual')
    expect(next.validUntil).toEqual(validUntil)
  })
  it('записывает источник подтверждения: Toolsy', () => {
    const { next } = applyEvent(state(), { type: 'paid_confirmed', source: 'toolsy' }, options)

    expect(next.status).toBe('active')
    expect(next.source).toBe('toolsy')
    // Конец наступает по событию, а не по дате из Toolsy (ADR-0031)
    expect(next.validUntil).toBeNull()
  })

  it('считает изменением смену источника при действующем доступе', () => {
    const current = state({ status: 'active', source: 'telegram_channel' })

    // Доступ не прерывается, но в журнале должно остаться, кто теперь его подтверждает
    const { next, changed } = applyEvent(
      current,
      { type: 'paid_confirmed', source: 'toolsy' },
      options,
    )

    expect(next.status).toBe('active')
    expect(next.source).toBe('toolsy')
    expect(changed).toBe(true)
  })
})

describe('подтверждения оплаты больше нет', () => {
  it('переводит в льготный период, а не отбирает доступ сразу', () => {
    const current = state({ status: 'active', source: 'telegram_channel' })

    const { next } = applyEvent(current, { type: 'paid_lost' }, options)

    expect(next.status).toBe('grace')
    expect(next.graceUntil).toEqual(new Date(NOW.getTime() + days(GRACE_DAYS)))
  })

  it('сохраняет доступ на время льготного периода', () => {
    const current = state({ status: 'active', source: 'telegram_channel' })
    const { next } = applyEvent(current, { type: 'paid_lost' }, options)

    expect(grantsAccess(next.status)).toBe(true)
  })

  it('не продлевает льготный период повторным событием', () => {
    // Иначе человек мог бы бесконечно продлевать доступ, входя и выходя
    const graceUntil = new Date(NOW.getTime() + days(2))
    const current = state({ status: 'grace', source: 'telegram_channel', graceUntil })

    const { next, changed } = applyEvent(current, { type: 'paid_lost' }, options)

    expect(next.graceUntil).toEqual(graceUntil)
    expect(changed).toBe(false)
  })

  it('ничего не меняет, если доступа и так не было', () => {
    expect(applyEvent(state(), { type: 'paid_lost' }, options).changed).toBe(false)
    expect(applyEvent(state({ status: 'expired' }), { type: 'paid_lost' }, options).changed).toBe(
      false,
    )
  })

  it('не отбирает доступ, выданный вручную', () => {
    // Ручная выдача применяется, когда автоматика ошиблась,
    // и события Telegram не должны её отменять
    const current = state({ status: 'active', source: 'manual' })

    const { next, changed } = applyEvent(current, { type: 'paid_lost' }, options)

    expect(next.status).toBe('active')
    expect(changed).toBe(false)
  })
})

describe('ручное управление', () => {
  it('выдаёт бессрочный доступ', () => {
    const { next } = applyEvent(state(), { type: 'manual_grant', validUntil: null }, options)

    expect(next.status).toBe('active')
    expect(next.source).toBe('manual')
    expect(next.validUntil).toBeNull()
  })

  it('выдаёт доступ до указанной даты', () => {
    const validUntil = new Date(NOW.getTime() + days(30))

    const { next } = applyEvent(state(), { type: 'manual_grant', validUntil }, options)

    expect(next.validUntil).toEqual(validUntil)
  })

  it('отзывает доступ немедленно, без льготного периода', () => {
    const current = state({ status: 'active', source: 'telegram_channel' })

    const { next } = applyEvent(current, { type: 'manual_revoke' }, options)

    expect(next.status).toBe('expired')
    expect(next.graceUntil).toBeNull()
    expect(grantsAccess(next.status)).toBe(false)
  })

  it('не мешает вернуть доступ честной оплатой после ручного отзыва', () => {
    // Ручной отзыв означает «отменить ошибочную выдачу», а не «наказать».
    // Для постоянной блокировки есть отдельный механизм — право users.ban.
    const revoked = state({ status: 'expired', source: 'manual' })

    const { next } = applyEvent(
      revoked,
      { type: 'paid_confirmed', source: 'telegram_channel' },
      options,
    )

    expect(next.status).toBe('active')
    expect(next.source).toBe('telegram_channel')
  })

  it('перебивает состояние, пришедшее из Telegram', () => {
    const current = state({ status: 'expired', source: 'telegram_channel' })

    const { next } = applyEvent(current, { type: 'manual_grant', validUntil: null }, options)

    expect(next.status).toBe('active')
    expect(next.source).toBe('manual')
  })
})

describe('течение времени', () => {
  it('закрывает доступ по истечении льготного периода', () => {
    const current = state({
      status: 'grace',
      source: 'telegram_channel',
      graceUntil: new Date(NOW.getTime() - 1),
    })

    const { next } = applyEvent(current, { type: 'time_passed' }, options)

    expect(next.status).toBe('expired')
  })

  it('не трогает льготный период, пока он не истёк', () => {
    const current = state({
      status: 'grace',
      source: 'telegram_channel',
      graceUntil: new Date(NOW.getTime() + days(1)),
    })

    expect(applyEvent(current, { type: 'time_passed' }, options).changed).toBe(false)
  })

  it('переводит истёкшую ручную выдачу в льготный период, а не в отказ', () => {
    // Человек не должен потерять доступ посреди урока: у него есть неделя продлить
    const current = state({
      status: 'active',
      source: 'manual',
      validUntil: new Date(NOW.getTime() - 1),
    })

    const { next } = applyEvent(current, { type: 'time_passed' }, options)

    expect(next.status).toBe('grace')
    expect(next.graceUntil).toEqual(new Date(NOW.getTime() + days(GRACE_DAYS)))
  })

  it('не трогает бессрочный доступ по членству в канале', () => {
    const current = state({ status: 'active', source: 'telegram_channel' })

    expect(applyEvent(current, { type: 'time_passed' }, options).changed).toBe(false)
  })

  it('ничего не меняет для того, у кого доступа нет', () => {
    expect(applyEvent(state(), { type: 'time_passed' }, options).changed).toBe(false)
  })
})

describe('daysUntilLoss', () => {
  it('считает дни до конца льготного периода', () => {
    const current = state({ status: 'grace', graceUntil: new Date(NOW.getTime() + days(3)) })

    expect(daysUntilLoss(current, NOW)).toBe(3)
  })

  it('считает дни до конца срока ручной выдачи', () => {
    const current = state({ status: 'active', validUntil: new Date(NOW.getTime() + days(10)) })

    expect(daysUntilLoss(current, NOW)).toBe(10)
  })

  it('возвращает null для бессрочного доступа', () => {
    expect(daysUntilLoss(state({ status: 'active' }), NOW)).toBeNull()
  })

  it('не показывает отрицательных дней', () => {
    const current = state({ status: 'grace', graceUntil: new Date(NOW.getTime() - days(5)) })

    expect(daysUntilLoss(current, NOW)).toBe(0)
  })
})

describe('полный жизненный путь участника', () => {
  it('оплатил → бросил → вернулся через неделю', () => {
    let current = state()

    current = applyEvent(
      current,
      { type: 'paid_confirmed', source: 'telegram_channel' },
      options,
    ).next
    expect(current.status).toBe('active')

    // Отменил подписку
    current = applyEvent(current, { type: 'paid_lost' }, options).next
    expect(current.status).toBe('grace')

    // Прошло восемь дней
    const later = new Date(NOW.getTime() + days(8))
    current = applyEvent(
      current,
      { type: 'time_passed' },
      { graceDays: GRACE_DAYS, now: later },
    ).next
    expect(current.status).toBe('expired')

    // Оплатил снова
    current = applyEvent(
      current,
      { type: 'paid_confirmed', source: 'telegram_channel' },
      { graceDays: GRACE_DAYS, now: later },
    ).next
    expect(current.status).toBe('active')
    expect(grantsAccess(current.status)).toBe(true)
  })

  it('передумал в льготный период — доступ не прерывался', () => {
    let current = state({ status: 'active', source: 'telegram_channel' })

    current = applyEvent(current, { type: 'paid_lost' }, options).next
    expect(grantsAccess(current.status)).toBe(true)

    const inThreeDays = new Date(NOW.getTime() + days(3))
    current = applyEvent(
      current,
      { type: 'paid_confirmed', source: 'telegram_channel' },
      { graceDays: GRACE_DAYS, now: inThreeDays },
    ).next

    expect(current.status).toBe('active')
    expect(current.graceUntil).toBeNull()
  })
})
