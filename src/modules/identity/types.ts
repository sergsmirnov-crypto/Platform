/**
 * Типы модуля «Личность».
 *
 * Модуль отвечает на вопрос «кто передо мной», но не на вопрос
 * «что ему можно»: права живут в модуле `access`, подписка — в `subscription`.
 */

/** Человек в том виде, в каком его показывают интерфейсу */
export type SessionUser = {
  id: string
  displayName: string
  avatarUrl: string | null
  onboardingDoneAt: Date | null
}

/**
 * Результат распознавания сессии.
 *
 * Возвращается всем, кому нужно знать текущего человека. Идентификатор
 * сессии здесь нужен, чтобы в списке устройств отметить текущее
 * и не дать человеку случайно закрыть сессию, в которой он сидит.
 */
export type SessionContext = {
  sessionId: string
  user: SessionUser
}

/** Сведения об устройстве, с которого вошли. Показываются в настройках */
export type SessionDevice = {
  id: string
  userAgent: string | null
  createdAt: Date
  lastUsedAt: Date
  expiresAt: Date
  /** Та ли это сессия, из которой человек смотрит страницу сейчас */
  isCurrent: boolean
}

/** Откуда пришёл запрос на вход. Нужно для списка устройств и защиты от перебора */
export type RequestOrigin = {
  userAgent: string | null
  ip: string | null
}
