import { z } from 'zod'

/**
 * Описание всех переменных окружения и правил их проверки.
 *
 * Файл намеренно отделён от `env.server.ts`: здесь только схема и чистая
 * функция разбора, без обращений к `process.env`. Благодаря этому правила
 * можно покрыть тестами, не подменяя окружение процесса.
 *
 * Принцип: приложение не должно запускаться с неверными настройками.
 * Лучше отказ при старте с понятным сообщением, чем непонятная ошибка
 * через два часа работы у участника клуба.
 */

/**
 * Проверка, что строка — это адрес сайта.
 *
 * Проверка протокола обязательна: `new URL('localhost:3000')` не выбрасывает
 * ошибку — такая строка разбирается как адрес со схемой `localhost:`.
 * Без этой проверки опечатка в адресе прошла бы незамеченной.
 */
const urlString = (message: string) =>
  z.string().refine(
    (value) => {
      try {
        const url = new URL(value)
        return url.protocol === 'http:' || url.protocol === 'https:'
      } catch {
        return false
      }
    },
    { message },
  )

/** Пустая строка в .env означает «не задано», а не «задано пустым». */
const optionalText = z
  .string()
  .transform((value) => (value.trim() === '' ? undefined : value.trim()))
  .optional()

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // ─── Приложение ───
  NEXT_PUBLIC_APP_URL: urlString('Должен быть полный адрес, например http://localhost:3000'),

  // ─── Доступ ───
  AUTH_ENABLED: z.enum(['true', 'false']).default('false'),

  // ─── База данных (используется с шага F4) ───
  DATABASE_URL: optionalText,

  // ─── Telegram (используется с Этапа 2) ───
  TELEGRAM_BOT_TOKEN: optionalText,
  TELEGRAM_BOT_USERNAME: optionalText,
  TELEGRAM_WEBHOOK_SECRET: optionalText,
  TELEGRAM_CHANNEL_ID: optionalText,
  OWNER_TELEGRAM_ID: optionalText,

  // ─── Сессии (используются с Этапа 2) ───
  SESSION_SECRET: optionalText,

  // ─── Хранилище файлов (используется с Этапа 4) ───
  /**
   * Где лежат файлы: 's3' в бою, 'local' на машине разработчика.
   * Локальное хранилище в производственной среде запрещено — проверка ниже
   */
  STORAGE_PROVIDER: z.enum(['s3', 'local']).default('local'),
  /** Адрес, по которому публичные файлы доступны снаружи: CDN или endpoint */
  S3_PUBLIC_URL: optionalText,
  S3_ENDPOINT: optionalText,
  S3_REGION: optionalText,
  S3_BUCKET: optionalText,
  S3_ACCESS_KEY_ID: optionalText,
  S3_SECRET_ACCESS_KEY: optionalText,

  // ─── Видеохостинг (используется с шага 5.4) ───
  /**
   * Какой хостинг используется. `none` — видео не показывается вовсе:
   * так проект можно поднять, не заводя учётной записи и не платя.
   * Добавление второго поставщика — новое значение здесь и новый файл
   * в `shared/video`, без изменений на страницах
   */
  VIDEO_PROVIDER: z.enum(['kinescope', 'none']).default('none'),
  /** Токен API видеохостинга. Нужен скрипту настройки и загрузке роликов */
  VIDEO_API_KEY: optionalText,
  /** Проект (у Kinescope) или библиотека, куда складываются ролики */
  VIDEO_LIBRARY_ID: optionalText,
  /** Логин и пароль, под которыми хостинг обращается к нам за разрешением */
  VIDEO_AUTH_USER: optionalText,
  VIDEO_AUTH_PASSWORD: optionalText,

  // ─── Наблюдаемость (используется с шага F6) ───
  SENTRY_DSN: optionalText,
  NEXT_PUBLIC_POSTHOG_KEY: optionalText,
  NEXT_PUBLIC_POSTHOG_HOST: optionalText,
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

/**
 * Дополнительные правила, которые нельзя выразить проверкой одного поля:
 * они связывают переменные между собой.
 *
 * Именно здесь закрывается дыра, оставленная на шаге F1: в производственной
 * среде платформа не имеет права запуститься с выключенной проверкой входа.
 */
function checkCrossRules(env: ServerEnv, addIssue: (path: string, message: string) => void): void {
  const isProduction = env.NODE_ENV === 'production'
  const authEnabled = env.AUTH_ENABLED === 'true'

  if (isProduction && !authEnabled) {
    addIssue(
      'AUTH_ENABLED',
      'В производственной среде проверка входа обязана быть включена: значение должно быть "true". ' +
        'Иначе закрытая зона платформы окажется доступна всем.',
    )
  }

  // Вход через Telegram требует токена бота и секрета для подписи сессий.
  if (authEnabled) {
    if (!env.TELEGRAM_BOT_TOKEN) {
      addIssue(
        'TELEGRAM_BOT_TOKEN',
        'Обязателен, когда AUTH_ENABLED=true: без него вход невозможен.',
      )
    }
    if (!env.TELEGRAM_BOT_USERNAME) {
      addIssue('TELEGRAM_BOT_USERNAME', 'Обязателен, когда AUTH_ENABLED=true: нужен виджету входа.')
    }
    if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
      addIssue(
        'SESSION_SECRET',
        'Обязателен, когда AUTH_ENABLED=true, и должен быть не короче 32 символов. ' +
          'Сгенерировать: openssl rand -base64 32',
      )
    }
  }

  if (isProduction) {
    if (!env.DATABASE_URL) {
      addIssue('DATABASE_URL', 'Обязателен в производственной среде.')
    }
    if (!env.NEXT_PUBLIC_APP_URL.startsWith('https://')) {
      addIssue(
        'NEXT_PUBLIC_APP_URL',
        'В производственной среде адрес обязан начинаться с https:// — cookie сессии ' +
          'с префиксом __Host- по HTTP работать не будет.',
      )
    }

    // Хранилище на диске не переживает пересоздание контейнера: все аватары
    // и материалы исчезнут при первом же обновлении платформы
    if (env.STORAGE_PROVIDER === 'local') {
      addIssue(
        'STORAGE_PROVIDER',
        'В производственной среде файлы обязаны лежать в S3: значение должно быть "s3". ' +
          'Локальная папка исчезнет при первом обновлении платформы вместе со всеми файлами.',
      )
    }
  }

  // Работа с S3 требует полного набора: половина настроек хуже, чем ничего —
  // приложение поднимется и упадёт при первой загрузке файла
  // Видеохостинг подключён — значит, он должен уметь спросить у нас
  // разрешение, а мы обязаны узнать в обратившемся именно его
  if (env.VIDEO_PROVIDER !== 'none') {
    if (!env.VIDEO_API_KEY) {
      addIssue('VIDEO_API_KEY', 'Обязателен, когда VIDEO_PROVIDER не "none".')
    }
    if (!env.VIDEO_LIBRARY_ID) {
      addIssue('VIDEO_LIBRARY_ID', 'Обязателен, когда VIDEO_PROVIDER не "none".')
    }
    if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
      addIssue(
        'SESSION_SECRET',
        'Обязателен для подписи ключей воспроизведения и должен быть не короче 32 символов.',
      )
    }
  }

  if (isProduction && env.VIDEO_PROVIDER !== 'none') {
    for (const variable of ['VIDEO_AUTH_USER', 'VIDEO_AUTH_PASSWORD'] as const) {
      if (!env[variable]) {
        addIssue(
          variable,
          'Обязателен в производственной среде: без него обработчик разрешений ' +
            'на воспроизведение открыт всему интернету.',
        )
      }
    }
  }

  if (env.STORAGE_PROVIDER === 's3') {
    const required = [
      'S3_ENDPOINT',
      'S3_REGION',
      'S3_BUCKET',
      'S3_ACCESS_KEY_ID',
      'S3_SECRET_ACCESS_KEY',
      'S3_PUBLIC_URL',
    ] as const

    for (const variable of required) {
      if (!env[variable]) {
        addIssue(variable, 'Обязателен, когда STORAGE_PROVIDER=s3.')
      }
    }
  }
}

export type EnvIssue = { variable: string; message: string }

export type ParseResult = { success: true; env: ServerEnv } | { success: false; issues: EnvIssue[] }

/**
 * Разбирает и проверяет переменные окружения.
 *
 * @param raw   исходные значения (обычно `process.env`)
 * @param strict применять ли связанные правила. Отключается во время сборки:
 *               там переменные ещё не заданы, а собирать проект это не мешает.
 */
export function parseServerEnv(
  raw: Record<string, string | undefined>,
  strict = true,
): ParseResult {
  const parsed = serverEnvSchema.safeParse(raw)

  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues.map((issue) => ({
        variable: issue.path.join('.') || '(неизвестно)',
        message: issue.message,
      })),
    }
  }

  if (!strict) {
    return { success: true, env: parsed.data }
  }

  const issues: EnvIssue[] = []
  checkCrossRules(parsed.data, (variable, message) => issues.push({ variable, message }))

  return issues.length > 0 ? { success: false, issues } : { success: true, env: parsed.data }
}
