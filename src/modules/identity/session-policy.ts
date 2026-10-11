/**
 * Правила жизни сессии.
 *
 * Чистые функции без обращений к базе и окружению: сюда передают уже
 * прочитанные записи, отсюда получают решение. Так все пограничные случаи
 * (сессия истекла ровно сейчас, отозвана, устройств стало больше нормы)
 * проверяются тестами, а не выясняются на живых участниках.
 *
 * Решение о самой модели сессий — в ADR-0003: одна случайная строка в cookie,
 * её хеш в базе, срок 90 дней с продлением при активности. Ротация ключа
 * при каждом запросе, заложенная в PRD v0.1 §7.2, не нужна: она решает
 * проблему JWT, который нельзя отозвать. Серверную сессию мы отзываем
 * мгновенно, поэтому смысла в ротации нет, а гонки между вкладками
 * она бы создала.
 */

/** Минимум полей сессии, нужный для принятия решений */
export type SessionTiming = {
  createdAt: Date
  lastUsedAt: Date
  expiresAt: Date
  revokedAt: Date | null
}

/**
 * Можно ли пользоваться этой сессией.
 *
 * Отозванная — нельзя никогда: это выход с устройства или снятие доступа
 * администратором, и оно должно действовать немедленно.
 */
export function isSessionUsable(session: SessionTiming, now: Date): boolean {
  if (session.revokedAt !== null) return false

  return session.expiresAt.getTime() > now.getTime()
}

/** Момент, до которого действует новая или продлённая сессия */
export function computeExpiry(now: Date, lifetimeDays: number): Date {
  return new Date(now.getTime() + lifetimeDays * 24 * 60 * 60 * 1000)
}

/**
 * Пора ли продлевать сессию.
 *
 * Продление — это запись в базу. Делать её на каждый запрос расточительно:
 * человек открывает десятки страниц за сеанс, а срок при этом сдвигается
 * на незаметную величину. Поэтому продлеваем не чаще раза в заданный
 * промежуток.
 */
export function shouldExtend(session: SessionTiming, now: Date, minIntervalMs: number): boolean {
  return now.getTime() - session.lastUsedAt.getTime() >= minIntervalMs
}

/** Сессия для решения об ограничении числа устройств */
export type SessionForLimit = { id: string; lastUsedAt: Date }

/**
 * Какие сессии закрыть, чтобы уложиться в лимит устройств.
 *
 * Мера против раздачи одного аккаунта на десятерых (PRD v0.2 §2.1).
 * Закрываются самые давно не использованные: человек, который зашёл
 * с нового телефона, не должен вылететь с того устройства, за которым
 * сидит прямо сейчас.
 *
 * @param existing   действующие сессии человека, без учёта создаваемой
 * @param maxDevices сколько устройств разрешено одновременно
 * @returns идентификаторы сессий, которые нужно отозвать
 */
export function pickSessionsToRevoke(
  existing: readonly SessionForLimit[],
  maxDevices: number,
): string[] {
  // Место под создаваемую сессию: если разрешено 3 устройства,
  // после входа с четвёртого должны остаться 2 старых и 1 новая
  const allowedToKeep = Math.max(0, maxDevices - 1)

  if (existing.length <= allowedToKeep) return []

  return [...existing]
    .sort((a, b) => b.lastUsedAt.getTime() - a.lastUsedAt.getTime())
    .slice(allowedToKeep)
    .map((session) => session.id)
}
