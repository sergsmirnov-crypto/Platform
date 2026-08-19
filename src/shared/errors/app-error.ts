/**
 * Типы ошибок приложения.
 *
 * Смысл в том, чтобы отличать ожидаемые ситуации от настоящих поломок.
 *
 * «Разбор не найден» и «нет прав на редактирование» — это не сбои,
 * а нормальные повороты сценария: человеку нужно понятное сообщение,
 * и разработчика будить не надо. А вот «база не отвечает» — сбой,
 * и он должен долететь до Sentry.
 *
 * Без такого разделения журнал ошибок за неделю заполняется шумом,
 * настоящие поломки в нём тонут, и на оповещения перестают смотреть.
 */

/** Коды ошибок. Приходят на клиент, поэтому не должны раскрывать внутренности. */
export const ERROR_CODES = {
  /** Не авторизован: нет сессии или она истекла */
  UNAUTHORIZED: 'unauthorized',
  /** Авторизован, но прав не хватает */
  FORBIDDEN: 'forbidden',
  /** Нет активной подписки */
  SUBSCRIPTION_REQUIRED: 'subscription_required',
  /** Объект не найден или скрыт от этого человека */
  NOT_FOUND: 'not_found',
  /** Данные формы не прошли проверку */
  VALIDATION_FAILED: 'validation_failed',
  /** Действие невозможно в текущем состоянии: например, публикация пустого разбора */
  CONFLICT: 'conflict',
  /** Слишком много запросов */
  RATE_LIMITED: 'rate_limited',
  /** Внешний сервис недоступен: видеохостинг, Telegram, хранилище */
  UPSTREAM_UNAVAILABLE: 'upstream_unavailable',
  /** Всё остальное: настоящая поломка */
  INTERNAL: 'internal',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

/** Сообщения по умолчанию — на случай, если своё не задали */
const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  unauthorized: 'Нужно войти в клуб',
  forbidden: 'Недостаточно прав для этого действия',
  subscription_required: 'Для доступа к материалам нужна активная подписка',
  not_found: 'Не найдено',
  validation_failed: 'Проверьте заполненные поля',
  conflict: 'Действие сейчас невозможно',
  rate_limited: 'Слишком много попыток. Попробуйте через минуту',
  upstream_unavailable: 'Сервис временно недоступен. Попробуйте позже',
  internal: 'Что-то пошло не так на нашей стороне',
}

/** Ошибки этих типов ожидаемы и в Sentry не отправляются */
const EXPECTED_CODES = new Set<ErrorCode>([
  ERROR_CODES.UNAUTHORIZED,
  ERROR_CODES.FORBIDDEN,
  ERROR_CODES.SUBSCRIPTION_REQUIRED,
  ERROR_CODES.NOT_FOUND,
  ERROR_CODES.VALIDATION_FAILED,
  ERROR_CODES.CONFLICT,
  ERROR_CODES.RATE_LIMITED,
])

/** Какой ответ HTTP соответствует коду */
const HTTP_STATUS: Record<ErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  subscription_required: 402,
  not_found: 404,
  validation_failed: 422,
  conflict: 409,
  rate_limited: 429,
  upstream_unavailable: 503,
  internal: 500,
}

type AppErrorOptions = {
  /** Сообщение для человека. Объясняет, что не так и что делать */
  message?: string
  /** Ошибки по полям формы */
  fields?: Record<string, string>
  /** Исходная ошибка — попадёт в журнал, но не к пользователю */
  cause?: unknown
  /** Дополнительный контекст для журнала. Секретов здесь быть не должно */
  context?: Record<string, unknown>
}

export class AppError extends Error {
  readonly code: ErrorCode
  readonly fields?: Record<string, string>
  readonly context?: Record<string, unknown>

  constructor(code: ErrorCode, options: AppErrorOptions = {}) {
    super(options.message ?? DEFAULT_MESSAGES[code], { cause: options.cause })
    this.name = 'AppError'
    this.code = code
    if (options.fields) this.fields = options.fields
    if (options.context) this.context = options.context
  }

  /** Ожидаемая ситуация, а не поломка */
  get isExpected(): boolean {
    return EXPECTED_CODES.has(this.code)
  }

  get httpStatus(): number {
    return HTTP_STATUS[this.code]
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

/**
 * Приводит любую пойманную ошибку к AppError.
 *
 * Неизвестные ошибки становятся `internal`: наружу уходит общее сообщение,
 * а подробности остаются в журнале. Иначе текст вроде
 * «duplicate key value violates unique constraint» уехал бы на экран
 * участнику клуба.
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error
  return new AppError(ERROR_CODES.INTERNAL, { cause: error })
}

// ─── Короткие способы создать типовые ошибки ───

export const errors = {
  unauthorized: (message?: string) =>
    new AppError(ERROR_CODES.UNAUTHORIZED, message ? { message } : {}),
  forbidden: (message?: string) => new AppError(ERROR_CODES.FORBIDDEN, message ? { message } : {}),
  subscriptionRequired: () => new AppError(ERROR_CODES.SUBSCRIPTION_REQUIRED),
  notFound: (what = 'Не найдено') => new AppError(ERROR_CODES.NOT_FOUND, { message: what }),
  validation: (fields: Record<string, string>, message?: string) =>
    new AppError(ERROR_CODES.VALIDATION_FAILED, message ? { fields, message } : { fields }),
  conflict: (message: string) => new AppError(ERROR_CODES.CONFLICT, { message }),
  rateLimited: () => new AppError(ERROR_CODES.RATE_LIMITED),
  upstream: (service: string, cause?: unknown) =>
    new AppError(ERROR_CODES.UPSTREAM_UNAVAILABLE, {
      context: { service },
      ...(cause === undefined ? {} : { cause }),
    }),
  internal: (cause?: unknown) =>
    new AppError(ERROR_CODES.INTERNAL, cause === undefined ? {} : { cause }),
}
