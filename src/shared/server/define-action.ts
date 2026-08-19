import 'server-only'

import { errors, toAppError } from '@/shared/errors'
import { getLogger } from '@/shared/logger'
import { reportError } from '@/shared/observability'
import { failure, success } from '@/shared/result'
import type { ActionResult } from '@/shared/result'

import type { ZodType } from 'zod'

/**
 * Обёртка для всех действий сервера.
 *
 * Собирает в одном месте то, что иначе пришлось бы повторять в каждом
 * обработчике и рано или поздно где-нибудь забыть:
 *
 *   1. проверку входных данных,
 *   2. обработку ошибок и приведение их к единому формату,
 *   3. запись в журнал,
 *   4. отправку настоящих поломок в Sentry.
 *
 * Именно «рано или поздно забыть» — главный аргумент. Пропущенная проверка
 * на одном обработчике из сорока незаметна на code review и обнаруживается
 * уже как инцидент.
 *
 * Проверка прав живёт рядом, в `requirePermission`, и вызывается внутри
 * тела действия — потому что для проверки области «только свой контент»
 * нужен сам объект, который к этому моменту уже загружен.
 */

type ActionHandler<TInput, TOutput> = (input: TInput) => Promise<TOutput>

type DefineActionOptions<TInput, TOutput> = {
  /** Имя действия для журнала: 'songs.publish' */
  name: string
  /** Схема проверки входных данных. Без неё действие не принимает аргументов */
  input?: ZodType<TInput>
  handler: ActionHandler<TInput, TOutput>
}

export function defineAction<TInput, TOutput>(
  options: DefineActionOptions<TInput, TOutput>,
): (raw: unknown) => Promise<ActionResult<TOutput>> {
  return async function runAction(raw: unknown): Promise<ActionResult<TOutput>> {
    const log = getLogger()
    const startedAt = Date.now()

    try {
      let input = raw as TInput

      if (options.input) {
        const parsed = options.input.safeParse(raw)

        if (!parsed.success) {
          // Ошибки раскладываются по полям, чтобы форма подсветила
          // именно то поле, где проблема
          const fields: Record<string, string> = {}
          for (const issue of parsed.error.issues) {
            const path = issue.path.join('.')
            if (path && !fields[path]) fields[path] = issue.message
          }
          throw errors.validation(fields)
        }

        input = parsed.data
      }

      const data = await options.handler(input)

      log.debug({ action: options.name, ms: Date.now() - startedAt }, 'действие выполнено')
      return success(data)
    } catch (error) {
      const appError = toAppError(error)
      const incidentId = reportError(appError, {
        action: options.name,
        ms: Date.now() - startedAt,
      })

      return failure(appError, appError.isExpected ? undefined : incidentId)
    }
  }
}
