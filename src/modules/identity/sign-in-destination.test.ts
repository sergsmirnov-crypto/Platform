import { describe, expect, it } from 'vitest'

import { signInDestination } from './sign-in-destination'

const routes = {
  connectTelegram: (next: string) => `/auth/connect?next=${next}`,
  onboarding: '/app/onboarding',
}

describe('signInDestination', () => {
  it('новичка без Telegram сначала ведёт подключать Telegram, затем на знакомство', () => {
    const destination = signInDestination(
      { isNewUser: true, hasTelegram: false, hasAccess: false, returnTo: '/app' },
      routes,
    )

    expect(destination).toBe('/auth/connect?next=/app/onboarding')
  })

  it('вернувшегося без Telegram ведёт подключать и потом туда, куда он шёл', () => {
    const destination = signInDestination(
      { isNewUser: false, hasTelegram: false, hasAccess: false, returnTo: '/app/learn/songs' },
      routes,
    )

    expect(destination).toBe('/auth/connect?next=/app/learn/songs')
  })

  it('с подключённым Telegram сразу пропускает дальше', () => {
    const destination = signInDestination(
      { isNewUser: false, hasTelegram: true, hasAccess: false, returnTo: '/app/streams' },
      routes,
    )

    expect(destination).toBe('/app/streams')
  })

  it('не требует Telegram от того, кому доступ выдан вручную', () => {
    // Владелец и участники с ручной выдачей: запирать их подключением
    // Telegram — значит не пустить того, кого пустили намеренно
    const destination = signInDestination(
      { isNewUser: true, hasTelegram: false, hasAccess: true, returnTo: '/app' },
      routes,
    )

    expect(destination).toBe('/app/onboarding')
  })
})
