import { randomInt, timingSafeEqual } from 'node:crypto'

import { hashWithSecret } from '@/shared/security/hashing'

/**
 * Правила одноразовых кодов входа.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЧИСТЫЕ ФУНКЦИИ: НИ БАЗЫ, НИ ПОЧТЫ, НИ ЧАСОВ
 *
 * Здесь решается, можно ли выдать код, годится ли введённый и что
 * сказать человеку. Ошибка в любом из этих решений — это либо дверь
 * в чужой аккаунт, либо участник, который не может войти. Поэтому
 * решения отделены от действий и проверены тестами, а текущее время
 * приходит аргументом.
 * ─────────────────────────────────────────────────────────────────
 */

export type CodeLimits = {
  codeLength: number
  codeLifetimeMinutes: number
  maxCodeAttempts: number
  resendCooldownSeconds: number
  maxCodesPerHour: number
}

/**
 * Новый код из цифр.
 *
 * `randomInt` из криптографического генератора, а не `Math.random`:
 * последовательность второго предсказуема по нескольким значениям.
 */
export function generateCode(length: number): string {
  return String(randomInt(0, 10 ** length)).padStart(length, '0')
}

/**
 * Хеш кода для хранения.
 *
 * В хеш входит идентификатор строки: код из одного письма нельзя
 * предъявить к другой записи, даже если цифры совпали.
 */
export function hashCode(code: string, codeId: string, secret: string): string {
  return hashWithSecret(`email-code:${codeId}:${code}`, secret)
}

/**
 * Совпадает ли введённый код с сохранённым.
 *
 * Сравнение за постоянное время: обычное `===` выходит на первом
 * несовпадающем символе, и по времени ответа хеш подбирается побайтно.
 */
export function codeMatches(
  input: string,
  stored: { id: string; codeHash: string },
  secret: string,
): boolean {
  const expected = Buffer.from(stored.codeHash, 'hex')
  const actual = Buffer.from(hashCode(input, stored.id, secret), 'hex')

  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

/** Человек мог вставить код с пробелами или дефисом: «123 456», «123-456» */
export function cleanCodeInput(raw: string): string {
  return raw.replace(/[\s-]/g, '')
}

export type IssueDecision =
  | { ok: true }
  /** Код только что отправлен — повтор раньше времени ничего не ускорит */
  | { ok: false; reason: 'cooldown'; retryAfterSeconds: number }
  /** Слишком много кодов за час: похоже на перебор или на зависшую форму */
  | { ok: false; reason: 'hourly_limit' }

/**
 * Можно ли отправить ещё один код на этот адрес.
 *
 * @param recent когда отправлен последний код и сколько их было за час
 */
export function canIssueCode(
  recent: { lastIssuedAt: Date | null; issuedLastHour: number },
  limits: Pick<CodeLimits, 'resendCooldownSeconds' | 'maxCodesPerHour'>,
  now: Date,
): IssueDecision {
  if (recent.issuedLastHour >= limits.maxCodesPerHour) {
    return { ok: false, reason: 'hourly_limit' }
  }

  if (recent.lastIssuedAt) {
    const elapsedSeconds = (now.getTime() - recent.lastIssuedAt.getTime()) / 1000
    const wait = Math.ceil(limits.resendCooldownSeconds - elapsedSeconds)

    if (wait > 0) {
      return { ok: false, reason: 'cooldown', retryAfterSeconds: wait }
    }
  }

  return { ok: true }
}

/** Сохранённый код в том виде, в каком его достаёт хранилище */
export type StoredCode = {
  id: string
  codeHash: string
  attempts: number
  expiresAt: Date
  consumedAt: Date | null
}

export type CodeCheck =
  | { ok: true }
  /** Действующего кода нет: не запрашивали, использован или заменён новым */
  | { ok: false; reason: 'missing' }
  | { ok: false; reason: 'expired' }
  /** Попытки кончились — код сгорел, нужен новый */
  | { ok: false; reason: 'exhausted' }
  | { ok: false; reason: 'wrong'; attemptsLeft: number }

/**
 * Годится ли введённый код.
 *
 * Попытка засчитывается до сравнения, а не после неудачи: иначе пять
 * одновременных запросов успели бы проверить пять вариантов, не увидев
 * счётчика друг друга. Поэтому сюда приходит уже увеличенное число попыток.
 *
 * @param attemptsAfterThis сколько попыток будет, считая текущую
 */
export function checkCode(
  stored: StoredCode | null,
  input: string,
  attemptsAfterThis: number,
  context: { secret: string; maxAttempts: number; now: Date },
): CodeCheck {
  if (!stored || stored.consumedAt) return { ok: false, reason: 'missing' }
  if (stored.expiresAt <= context.now) return { ok: false, reason: 'expired' }
  if (attemptsAfterThis > context.maxAttempts) return { ok: false, reason: 'exhausted' }

  if (codeMatches(input, stored, context.secret)) return { ok: true }

  const attemptsLeft = context.maxAttempts - attemptsAfterThis

  return attemptsLeft > 0
    ? { ok: false, reason: 'wrong', attemptsLeft }
    : { ok: false, reason: 'exhausted' }
}

/** Когда истекает код, выданный сейчас */
export function codeExpiry(now: Date, lifetimeMinutes: number): Date {
  return new Date(now.getTime() + lifetimeMinutes * 60 * 1000)
}
