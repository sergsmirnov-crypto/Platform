import 'server-only'

import { serverEnv } from '@/shared/config/env.server'
import { toAppError } from '@/shared/errors'
import { getLogger, getRequestContext } from '@/shared/logger'

/**
 * Единая точка обработки ошибок на сервере.
 *
 * Ожидаемые ситуации («не найдено», «нет прав») пишутся в журнал коротко
 * и наружу не уходят. Настоящие поломки пишутся со стеком и отправляются
 * в Sentry.
 *
 * Разделение принципиально: если слать в Sentry всё подряд, за неделю
 * там накопится тысяча записей «не найдено», настоящая поломка в них
 * утонет, и на оповещения перестанут смотреть.
 *
 * Sentry подключается через тонкую прослойку: пока адрес проекта не задан,
 * функция просто ничего не делает, и приложение работает как обычно.
 */

/** Возвращает идентификатор происшествия — его можно показать человеку */
export function reportError(error: unknown, extra?: Record<string, unknown>): string {
  const appError = toAppError(error)
  const context = getRequestContext()
  const incidentId = context?.requestId ?? crypto.randomUUID()
  const log = getLogger()

  const payload = {
    code: appError.code,
    incidentId,
    ...appError.context,
    ...extra,
  }

  if (appError.isExpected) {
    // Ожидаемая ситуация: одна строка, без стека, без Sentry
    log.info(payload, appError.message)
    return incidentId
  }

  log.error({ ...payload, err: appError, cause: appError.cause }, appError.message)
  sendToSentry(appError, payload)

  return incidentId
}

/**
 * Отправка в Sentry.
 *
 * Реализация появится вместе с боевым развёртыванием: подключать сбор
 * ошибок, пока приложение работает только на компьютере разработчика,
 * бессмысленно. Прослойка существует уже сейчас, чтобы все вызовы
 * `reportError` не пришлось переписывать потом.
 */
function sendToSentry(error: Error, payload: Record<string, unknown>): void {
  if (!serverEnv.SENTRY_DSN) return

  // Заглушка. При появлении @sentry/nextjs здесь будет captureException.
  void error
  void payload
}
