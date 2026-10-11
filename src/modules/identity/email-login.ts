import 'server-only'

import { v7 as uuidv7 } from 'uuid'

import { appConfig } from '@/shared/config'
import { requireSessionSecret } from '@/shared/config/secrets'
import { isUniqueViolation } from '@/shared/db'
import { maskEmail } from '@/shared/email'
import { getEmailSender } from '@/shared/email/sender'
import { errors } from '@/shared/errors'
import { getLogger } from '@/shared/logger'
import { checkRateLimit } from '@/shared/security/rate-limit'

import { canIssueCode, checkCode, codeExpiry, generateCode, hashCode } from './email-code-policy'
import {
  consumeCode,
  createUserWithEmailIdentity,
  deleteCode,
  findActiveCode,
  findRecentCodeStats,
  findUserByEmail,
  registerCodeAttempt,
  replaceActiveCode,
} from './email-login-repository'
import { loginCodeEmail } from './email-templates'
import { grantOwnerRoleIfNeeded } from './owner-bootstrap'
import { hashClientIp, startSession } from './service'
import { identityStrings } from './strings'
import { DEFAULT_DISPLAY_NAME } from './telegram-profile'

import type { CodeCheck } from './email-code-policy'
import type { IdentityWithUser } from './repository'
import type { RequestOrigin, SessionUser } from './types'

/**
 * Вход по коду на почту.
 *
 * Два шага, два вызова:
 *
 *   1. `requestLoginCode` — человек ввёл адрес, мы отправили код;
 *   2. `signInWithLoginCode` — человек ввёл код, мы открыли сессию.
 *
 * Аккаунт создаётся на втором шаге, а не на первом: до ввода кода
 * мы не знаем, принадлежит ли адрес тому, кто его набрал.
 *
 * Отдельной регистрации нет. Первый вход и есть регистрация: человек
 * с новым адресом получает аккаунт, но не доступ — доступ даёт подписка,
 * подтверждённая через Telegram.
 */

const strings = identityStrings.emailLogin

/** Ограничения по адресу запроса: сверх лимитов на конкретную почту */
const IP_LIMITS = {
  request: { limit: 10, windowSeconds: 600 },
  verify: { limit: 30, windowSeconds: 600 },
} as const

function limitByIp(action: keyof typeof IP_LIMITS, origin: RequestOrigin): void {
  const { allowed } = checkRateLimit({
    action: `email-login.${action}`,
    subject: origin.ip ?? 'unknown',
    ...IP_LIMITS[action],
  })

  if (!allowed) {
    getLogger().warn({ action }, 'превышено число попыток входа по почте с одного адреса')
    throw errors.rateLimited()
  }
}

export type LoginCodeRequested = {
  /** Адрес в виде «iv***@mail.ru» — для экрана «код отправлен» */
  maskedEmail: string
  /** Через сколько секунд можно попросить код ещё раз */
  resendAfterSeconds: number
}

/**
 * Отправляет код входа.
 *
 * Ответ одинаков для известного и нового адреса: по нему нельзя
 * узнать, состоит ли человек в клубе.
 *
 * @param email уже проверенный и приведённый адрес (`emailSchema`)
 */
export async function requestLoginCode(
  email: string,
  origin: RequestOrigin,
): Promise<LoginCodeRequested> {
  limitByIp('request', origin)

  const limits = appConfig.auth
  const now = new Date()
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000)

  const decision = canIssueCode(await findRecentCodeStats(email, hourAgo), limits, now)

  if (!decision.ok) {
    throw decision.reason === 'cooldown'
      ? errors.validation({ email: strings.errors.cooldown(decision.retryAfterSeconds) })
      : errors.validation({ email: strings.errors.hourlyLimit })
  }

  const id = uuidv7()
  const code = generateCode(limits.codeLength)

  await replaceActiveCode({
    id,
    email,
    codeHash: hashCode(code, id, requireSessionSecret()),
    expiresAt: codeExpiry(now, limits.codeLifetimeMinutes),
    ipHash: hashClientIp(origin.ip),
  })

  try {
    await getEmailSender().send(
      loginCodeEmail({ to: email, code, lifetimeMinutes: limits.codeLifetimeMinutes }),
    )
  } catch (error) {
    await deleteCode(id)
    throw error
  }

  // Адрес в журнал — только маскированным: это персональные данные
  getLogger().info({ to: maskEmail(email) }, 'отправлен код входа')

  return { maskedEmail: maskEmail(email), resendAfterSeconds: limits.resendCooldownSeconds }
}

export type EmailSignInResult = {
  user: SessionUser
  token: string
  expiresAt: Date
  /** Впервые ли этот человек вошёл: нужно для перехода к знакомству */
  isNewUser: boolean
}

/** Ответ человеку на неудачный код — понятный и без подсказок подбирающему */
function codeError(check: Exclude<CodeCheck, { ok: true }>): never {
  switch (check.reason) {
    case 'wrong':
      throw errors.validation({ code: strings.errors.wrongCode(check.attemptsLeft) })
    case 'expired':
      throw errors.validation({ code: strings.errors.expired })
    case 'exhausted':
      throw errors.validation({ code: strings.errors.exhausted })
    case 'missing':
      throw errors.validation({ code: strings.errors.missing })
  }
}

/**
 * Проверяет код и открывает сессию.
 *
 * @param email уже проверенный и приведённый адрес
 * @param code  введённые цифры, очищенные от пробелов
 */
export async function signInWithLoginCode(
  email: string,
  code: string,
  origin: RequestOrigin,
): Promise<EmailSignInResult> {
  limitByIp('verify', origin)

  const log = getLogger()
  const now = new Date()
  const stored = await findActiveCode(email)

  // Попытка засчитывается до сравнения — см. `checkCode`
  const attempts = stored ? await registerCodeAttempt(stored.id) : 0

  const check = checkCode(stored, code, attempts, {
    secret: requireSessionSecret(),
    maxAttempts: appConfig.auth.maxCodeAttempts,
    now,
  })

  if (!check.ok) {
    if (check.reason === 'exhausted' && stored) await consumeCode(stored.id)
    log.info({ to: maskEmail(email), reason: check.reason }, 'код входа отклонён')
    codeError(check)
  }

  // Код проверен, но гасит его только один запрос: второй, пришедший
  // с тем же кодом в ту же секунду, получит отказ, а не вторую сессию
  if (!stored || !(await consumeCode(stored.id))) {
    codeError({ ok: false, reason: 'missing' })
  }

  const existing = await findUserByEmail(email)

  /*
   * Заблокированному вход закрыт — проверка до создания сессии,
   * по той же причине, что и при входе через Telegram: иначе человек
   * получил бы сессию, которую тут же отвергнет `resolveSession`,
   * и вместо объяснения увидел бы круг «вход → выброс на вход».
   */
  if (existing?.isBlocked) {
    log.warn({ userId: existing.userId }, 'вход заблокированного участника отклонён')
    throw errors.forbidden(identityStrings.errors.blocked)
  }

  const identity = existing ?? (await createOrFindByEmail(email))
  const isNewUser = existing === null

  if (isNewUser) {
    log.info({ userId: identity.userId }, 'создан новый участник')
  }

  await grantOwnerRoleIfNeeded(identity.userId, email)

  const { token, expiresAt } = await startSession(identity.userId, origin)

  return { user: identity.user, token, expiresAt, isNewUser }
}

/**
 * Создаёт участника — или находит того, кого только что создал соседний запрос.
 *
 * Два входа с одним новым адресом в одну секунду (двойное нажатие, два
 * устройства) упираются в уникальность адреса. Это не ошибка человека,
 * и показывать ему «что-то пошло не так» нельзя: аккаунт уже есть.
 */
async function createOrFindByEmail(email: string): Promise<IdentityWithUser> {
  try {
    return await createUserWithEmailIdentity(email, DEFAULT_DISPLAY_NAME)
  } catch (error) {
    if (!isUniqueViolation(error)) throw error

    const created = await findUserByEmail(email)
    if (!created) throw error

    return created
  }
}
