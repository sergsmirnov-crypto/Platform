import { toAppError } from '@/shared/errors'
import type { ErrorCode } from '@/shared/errors'

/**
 * Единый формат ответа любого действия сервера.
 *
 * Один формат на весь проект означает, что интерфейс всегда знает,
 * что показать: успех, сообщение об ошибке или подсветку конкретных
 * полей формы. Без этого каждая форма обрабатывала бы ошибки по-своему,
 * и половина случаев осталась бы необработанной.
 */

export type ActionSuccess<T> = { ok: true; data: T }

export type ActionFailure = {
  ok: false
  code: ErrorCode
  /** Готовое сообщение для человека */
  message: string
  /** Ошибки по конкретным полям формы */
  fields?: Record<string, string>
  /** Код происшествия — по нему находим причину в журнале */
  incidentId?: string
}

export type ActionResult<T> = ActionSuccess<T> | ActionFailure

export function success<T>(data: T): ActionSuccess<T> {
  return { ok: true, data }
}

export function failure(error: unknown, incidentId?: string): ActionFailure {
  const appError = toAppError(error)

  return {
    ok: false,
    code: appError.code,
    message: appError.message,
    ...(appError.fields ? { fields: appError.fields } : {}),
    ...(incidentId ? { incidentId } : {}),
  }
}
