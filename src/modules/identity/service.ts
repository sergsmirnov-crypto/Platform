import 'server-only'

import { appConfig } from '@/shared/config'
import { requireSessionSecret } from '@/shared/config/secrets'
import { errors } from '@/shared/errors'
import { getLogger } from '@/shared/logger'
import { generateToken, hashWithSecret } from '@/shared/security/hashing'

import {
  deleteStaleSessions,
  findActiveSessionDetails,
  findActiveSessions,
  findSessionByTokenHash,
  insertSession,
  revokeAllSessions,
  revokeSessions,
  touchSession,
  touchUserLastSeen,
} from './repository'
import {
  computeExpiry,
  isSessionUsable,
  pickSessionsToRevoke,
  shouldExtend,
} from './session-policy'

import type { RequestOrigin, SessionContext, SessionDevice } from './types'

/**
 * Жизненный цикл сессии: открыть, распознать, продлить, закрыть.
 *
 * Модель описана в ADR-0003: в cookie лежит случайная строка, в базе —
 * её хеш. Проверка на каждый запрос стоит один индексный запрос к базе,
 * зато отзыв доступа действует мгновенно, а список устройств в профиле
 * получается сам собой.
 */

/**
 * Как часто продлевать сессию.
 *
 * Раз в час: срок сдвигается на 90 дней вперёд, поэтому точность здесь
 * не нужна, а запись в базу на каждой открытой странице — лишняя.
 */
const EXTEND_INTERVAL_MS = 60 * 60 * 1000

/** Насколько давно закрытые сессии убираются из базы */
const CLEANUP_AFTER_DAYS = 30

// Секрет приложения общий для сессий и ключей воспроизведения:
// достаётся из одного места, разводится по назначению на месте использования
const sessionSecret = requireSessionSecret

/** Приводит сведения о запросе к тому, что можно хранить */
function describeOrigin(origin: RequestOrigin): {
  userAgent: string | null
  ipHash: string | null
} {
  return {
    // Строка браузера бывает очень длинной; в списке устройств нужны первые слова
    userAgent: origin.userAgent ? origin.userAgent.slice(0, 400) : null,
    // Адрес хранится только хешированным: это персональные данные
    ipHash: hashClientIp(origin.ip),
  }
}

/**
 * Хеш адреса, с которого пришёл запрос.
 *
 * IP-адрес — персональные данные, поэтому в базу он попадает только
 * в таком виде. Функция вынесена наружу, чтобы журнал действий считал
 * хеш тем же способом и тем же секретом: два разных способа означали бы,
 * что записи о сессии и о действии нельзя сопоставить при разборе случая.
 */
export function hashClientIp(ip: string | null): string | null {
  return ip ? hashWithSecret(ip, sessionSecret()) : null
}

/**
 * Открывает сессию для человека.
 *
 * Возвращает ключ, который нужно положить в cookie. Больше этот ключ
 * взять неоткуда: в базе лежит только его хеш, и восстановить исходную
 * строку невозможно.
 */
export async function startSession(
  userId: string,
  origin: RequestOrigin,
): Promise<{ token: string; sessionId: string; expiresAt: Date }> {
  const log = getLogger()
  const now = new Date()

  // Лимит устройств: самые давние сессии закрываются, чтобы один аккаунт
  // не расходился по десятку человек (PRD v0.2 §2.1)
  const existing = await findActiveSessions(userId)
  const toRevoke = pickSessionsToRevoke(existing, appConfig.session.maxActiveDevices)

  if (toRevoke.length > 0) {
    await revokeSessions(toRevoke)
    log.info({ userId, count: toRevoke.length }, 'закрыты сессии сверх лимита устройств')
  }

  const token = generateToken()
  const expiresAt = computeExpiry(now, appConfig.session.lifetimeDays)

  const sessionId = await insertSession({
    userId,
    tokenHash: hashWithSecret(token, sessionSecret()),
    expiresAt,
    ...describeOrigin(origin),
  })

  await touchUserLastSeen(userId)

  log.info({ userId, sessionId }, 'сессия открыта')

  return { token, sessionId, expiresAt }
}

/**
 * Определяет, кому принадлежит ключ сессии.
 *
 * Возвращает `null` для любой негодной сессии: неизвестной, отозванной,
 * истёкшей или принадлежащей удалённому участнику. Разницу между этими
 * случаями наружу не сообщаем — она полезна только тому, кто подбирает ключи.
 */
export async function resolveSession(token: string | undefined): Promise<SessionContext | null> {
  if (!token) return null

  const found = await findSessionByTokenHash(hashWithSecret(token, sessionSecret()))
  if (!found) return null

  const now = new Date()

  if (!isSessionUsable(found, now)) return null

  // Продление раз в час, а не на каждой странице
  if (shouldExtend(found, now, EXTEND_INTERVAL_MS)) {
    await touchSession(found.id, computeExpiry(now, appConfig.session.lifetimeDays))
    await touchUserLastSeen(found.userId)
  }

  return { sessionId: found.id, user: found.user }
}

/** Закрывает одну сессию — обычный выход */
export async function endSession(sessionId: string): Promise<void> {
  await revokeSessions([sessionId])
  getLogger().info({ sessionId }, 'сессия закрыта')
}

/**
 * Закрывает все сессии человека.
 *
 * Нужно в двух случаях: человек нажал «выйти на всех устройствах»
 * и администратор снял доступ. Во втором случае `exceptSessionId`
 * не передаётся — доступ должен пропасть везде.
 */
export async function endAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await revokeAllSessions(userId, exceptSessionId)
  getLogger().info({ userId, keptCurrent: Boolean(exceptSessionId) }, 'сессии человека закрыты')
}

/** Список устройств для экрана настроек */
export async function listDevices(
  userId: string,
  currentSessionId: string,
): Promise<SessionDevice[]> {
  const rows = await findActiveSessionDetails(userId)

  return rows.map((row) => ({
    ...row,
    isCurrent: row.id === currentSessionId,
  }))
}

/**
 * Закрывает одно устройство из списка настроек.
 *
 * Проверяет принадлежность: чужую сессию закрыть нельзя, даже зная
 * её идентификатор.
 */
export async function endDevice(userId: string, sessionId: string): Promise<void> {
  const own = await findActiveSessions(userId)

  if (!own.some((session) => session.id === sessionId)) {
    throw errors.notFound('Устройство не найдено')
  }

  await revokeSessions([sessionId])
}

/** Уборка мёртвых записей. Вызывается фоновой задачей */
export async function cleanupSessions(): Promise<number> {
  const before = new Date(Date.now() - CLEANUP_AFTER_DAYS * 24 * 60 * 60 * 1000)
  const removed = await deleteStaleSessions(before)

  if (removed > 0) {
    getLogger().info({ removed }, 'убраны устаревшие сессии')
  }

  return removed
}
