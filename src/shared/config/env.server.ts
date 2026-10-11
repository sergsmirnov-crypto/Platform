import 'server-only'

import { ENV_DESCRIPTIONS } from './env.descriptions'
import { parseServerEnv } from './env.schema'

import type { EnvIssue, ServerEnv } from './env.schema'

/**
 * Проверенные настройки сервера.
 *
 * Проверка выполняется один раз, при первой загрузке этого файла.
 * Если что-то не так — приложение не запускается и печатает,
 * какой именно переменной не хватает и где её взять.
 *
 * `import 'server-only'` — предохранитель: попытка использовать этот файл
 * в коде, который выполняется в браузере, станет ошибкой сборки.
 * Секреты не могут утечь на клиент по невнимательности.
 *
 * Публичные значения — в `env.client.ts`.
 */

/**
 * Во время сборки переменные окружения ещё не заданы: боевые значения
 * появляются только при запуске контейнера. Поэтому на этапе сборки
 * связанные правила («в производственной среде вход обязан быть включён»)
 * не применяются — они проверяются при старте приложения.
 */
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build'
const skipStrictChecks = isBuildPhase || process.env.SKIP_ENV_VALIDATION === 'true'

export function formatEnvIssues(issues: EnvIssue[]): string {
  const lines = issues.map((issue) => {
    const description = ENV_DESCRIPTIONS[issue.variable]
    return [
      `  ${issue.variable}`,
      `    ${issue.message}`,
      description ? `    Что это: ${description}` : null,
    ]
      .filter(Boolean)
      .join('\n')
  })

  return [
    '',
    'Не удалось запустить приложение: настройки заданы неверно.',
    '',
    ...lines,
    '',
    'Значения задаются в файле .env. Образец со всеми переменными — .env.example.',
    '',
  ].join('\n')
}

function loadEnv(): ServerEnv {
  const result = parseServerEnv(process.env, !skipStrictChecks)

  if (!result.success) {
    throw new Error(formatEnvIssues(result.issues))
  }

  return result.env
}

export const serverEnv: ServerEnv = loadEnv()

/** Короткие производные значения — чтобы не сравнивать строки по всему коду. */
export const isProduction = serverEnv.NODE_ENV === 'production'
export const isDevelopment = serverEnv.NODE_ENV === 'development'
export const isTest = serverEnv.NODE_ENV === 'test'
