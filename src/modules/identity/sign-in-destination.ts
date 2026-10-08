/**
 * Куда вести человека сразу после входа.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОРЯДОК: TELEGRAM → ЗНАКОМСТВО → ТУДА, КУДА ШЁЛ
 *
 * Подключение Telegram стоит первым, хотя знакомство — первое, что
 * хочется показать новичку. Причина: без Telegram платформа не знает,
 * оплачена ли подписка, и после знакомства человек упёрся бы в экран
 * «подписки нет» — хотя деньги он заплатил. Минута на подключение
 * в начале лучше, чем испуг в конце.
 *
 * Подключение предлагается только тем, у кого нет доступа. Владельцу
 * и участникам с доступом, выданным вручную, Telegram для доступа не нужен,
 * и требовать его от них — значит запереть того, кого пустили намеренно.
 * ─────────────────────────────────────────────────────────────────
 *
 * Чистая функция: о подписке и Telegram ей рассказывает вызывающий код,
 * сама она ни в базу, ни в другие модули не ходит.
 */

export type SignInFacts = {
  isNewUser: boolean
  hasTelegram: boolean
  hasAccess: boolean
  /** Куда человек шёл до входа, уже проверенный адрес внутри платформы */
  returnTo: string
}

export type SignInRoutes = {
  connectTelegram: (next: string) => string
  onboarding: string
}

export function signInDestination(facts: SignInFacts, routes: SignInRoutes): string {
  // Новичок после подключения Telegram попадает на знакомство,
  // остальные — туда, куда шли
  const afterTelegram = facts.isNewUser ? routes.onboarding : facts.returnTo

  if (!facts.hasTelegram && !facts.hasAccess) {
    return routes.connectTelegram(afterTelegram)
  }

  return afterTelegram
}
