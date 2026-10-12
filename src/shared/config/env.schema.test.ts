import { describe, expect, it } from 'vitest'

import { parseServerEnv } from './env.schema'

/** Минимальный набор, при котором приложение обязано запускаться локально. */
const minimalDev = {
  NODE_ENV: 'development',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  AUTH_ENABLED: 'false',
}

/** Значения, достаточные для боевого сервера. */
const validProduction = {
  NODE_ENV: 'production',
  NEXT_PUBLIC_APP_URL: 'https://club.example.com',
  AUTH_ENABLED: 'true',
  DATABASE_URL: 'postgresql://user:pass@db:5432/guitar_club',
  TELEGRAM_BOT_TOKEN: '123456:ABCDEF',
  TELEGRAM_BOT_USERNAME: 'guitar_club_bot',
  SESSION_SECRET: 'x'.repeat(32),
  STORAGE_PROVIDER: 's3',
  S3_ENDPOINT: 'https://s3.example.com',
  S3_REGION: 'ru-1',
  S3_BUCKET: 'guitar-club',
  S3_ACCESS_KEY_ID: 'key',
  S3_SECRET_ACCESS_KEY: 'secret',
  S3_PUBLIC_URL: 'https://cdn.example.com',
  EMAIL_PROVIDER: 'smtp',
  EMAIL_FROM: 'Гитарный клуб <noreply@club.example.com>',
  SMTP_HOST: 'smtp.example.com',
  SMTP_USER: 'noreply@club.example.com',
  SMTP_PASSWORD: 'password',
}

function issuesFor(raw: Record<string, string | undefined>): string[] {
  const result = parseServerEnv(raw)
  return result.success ? [] : result.issues.map((issue) => issue.variable)
}

describe('проверка переменных окружения', () => {
  it('пропускает минимальный набор для разработки', () => {
    const result = parseServerEnv(minimalDev)
    expect(result.success).toBe(true)
  })

  it('пропускает корректный набор для боевого сервера', () => {
    const result = parseServerEnv(validProduction)
    expect(result.success).toBe(true)
  })

  it('требует адрес приложения', () => {
    expect(issuesFor({ ...minimalDev, NEXT_PUBLIC_APP_URL: undefined })).toContain(
      'NEXT_PUBLIC_APP_URL',
    )
  })

  it('отвергает адрес, не являющийся ссылкой', () => {
    expect(issuesFor({ ...minimalDev, NEXT_PUBLIC_APP_URL: 'localhost:3000' })).toContain(
      'NEXT_PUBLIC_APP_URL',
    )
  })

  // Главная проверка этого шага: дыра, оставленная на F1, закрыта.
  it('не разрешает запуск боевого сервера с выключенной проверкой входа', () => {
    expect(issuesFor({ ...validProduction, AUTH_ENABLED: 'false' })).toContain('AUTH_ENABLED')
  })

  it('требует адрес по https на боевом сервере', () => {
    expect(
      issuesFor({ ...validProduction, NEXT_PUBLIC_APP_URL: 'http://club.example.com' }),
    ).toContain('NEXT_PUBLIC_APP_URL')
  })

  it('требует подключение к базе на боевом сервере', () => {
    expect(issuesFor({ ...validProduction, DATABASE_URL: undefined })).toContain('DATABASE_URL')
  })

  it('при включённом входе требует токен бота и секрет сессий', () => {
    const issues = issuesFor({
      NODE_ENV: 'development',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      AUTH_ENABLED: 'true',
    })
    expect(issues).toContain('TELEGRAM_BOT_TOKEN')
    expect(issues).toContain('TELEGRAM_BOT_USERNAME')
    expect(issues).toContain('SESSION_SECRET')
  })

  it('отвергает слишком короткий секрет сессий', () => {
    expect(issuesFor({ ...validProduction, SESSION_SECRET: 'короткий' })).toContain(
      'SESSION_SECRET',
    )
  })

  it('считает пустую строку в .env отсутствующим значением', () => {
    expect(issuesFor({ ...validProduction, DATABASE_URL: '   ' })).toContain('DATABASE_URL')
  })

  it('отвергает неизвестный видеохостинг', () => {
    expect(issuesFor({ ...minimalDev, VIDEO_PROVIDER: 'youtube' })).toContain('VIDEO_PROVIDER')
  })

  it('во время сборки связанные правила не применяются', () => {
    const result = parseServerEnv({ ...validProduction, AUTH_ENABLED: 'false' }, false)
    expect(result.success).toBe(true)
  })
})

describe('хранилище файлов', () => {
  it('не пускает локальное хранилище на боевой сервер', () => {
    expect(issuesFor({ ...validProduction, STORAGE_PROVIDER: 'local' })).toContain(
      'STORAGE_PROVIDER',
    )
  })

  it('требует полный набор настроек S3, а не половину', () => {
    const issues = issuesFor({ ...validProduction, S3_SECRET_ACCESS_KEY: undefined })
    expect(issues).toContain('S3_SECRET_ACCESS_KEY')
  })

  it('локально хранилище на диске допустимо', () => {
    expect(issuesFor({ ...minimalDev, STORAGE_PROVIDER: 'local' })).toEqual([])
  })
})

describe('почта для кодов входа', () => {
  it('не пускает на боевой сервер печать писем в журнал: войти не сможет никто', () => {
    expect(issuesFor({ ...validProduction, EMAIL_PROVIDER: 'console' })).toContain('EMAIL_PROVIDER')
  })

  it('по умолчанию печатает письма в журнал: разработке не нужен почтовый сервис', () => {
    const result = parseServerEnv(minimalDev)

    expect(result.success && result.env.EMAIL_PROVIDER).toBe('console')
  })

  it('требует полный набор настроек SMTP', () => {
    const issues = issuesFor({ ...validProduction, SMTP_PASSWORD: undefined, EMAIL_FROM: '' })

    expect(issues).toContain('SMTP_PASSWORD')
    expect(issues).toContain('EMAIL_FROM')
  })

  it('пустой порт в .env означает порт по умолчанию, а не ноль', () => {
    const result = parseServerEnv({ ...validProduction, SMTP_PORT: '' })

    expect(result.success && result.env.SMTP_PORT).toBe(465)
  })
})

describe('адрес Telegram Bot API', () => {
  it('по умолчанию — сам Telegram', () => {
    const result = parseServerEnv(minimalDev)

    expect(result.success && result.env.TELEGRAM_API_BASE_URL).toBe('https://api.telegram.org')
  })

  it('принимает адрес промежуточного сервера и убирает косую черту в конце', () => {
    const result = parseServerEnv({
      ...minimalDev,
      TELEGRAM_API_BASE_URL: 'https://relay.example.com/tg/',
    })

    expect(result.success && result.env.TELEGRAM_API_BASE_URL).toBe('https://relay.example.com/tg')
  })

  it('пустая строка в .env означает адрес по умолчанию', () => {
    const result = parseServerEnv({ ...minimalDev, TELEGRAM_API_BASE_URL: '' })

    expect(result.success && result.env.TELEGRAM_API_BASE_URL).toBe('https://api.telegram.org')
  })

  it('отвергает адрес без протокола', () => {
    expect(issuesFor({ ...minimalDev, TELEGRAM_API_BASE_URL: 'relay.example.com' })).toContain(
      'TELEGRAM_API_BASE_URL',
    )
  })
})

describe('Toolsy', () => {
  it('не обязателен: без него подписка подтверждается только чатом', () => {
    expect(issuesFor(validProduction)).toEqual([])
  })

  it('принимает полный набор ключей', () => {
    expect(
      issuesFor({ ...validProduction, TOOLSY_API_KEY: 'key', TOOLSY_WEBHOOK_SECRET: 'secret' }),
    ).toEqual([])
  })

  it('требует секрет уведомлений вместе с ключом API', () => {
    expect(issuesFor({ ...minimalDev, TOOLSY_API_KEY: 'key' })).toEqual(['TOOLSY_WEBHOOK_SECRET'])
  })

  it('требует ключ API вместе с секретом уведомлений', () => {
    expect(issuesFor({ ...minimalDev, TOOLSY_WEBHOOK_SECRET: 'secret' })).toEqual([
      'TOOLSY_API_KEY',
    ])
  })

  it('по умолчанию обращается к api.toolsy.bot и убирает косую черту в конце', () => {
    const fallback = parseServerEnv({ ...minimalDev, TOOLSY_API_BASE_URL: '' })
    const custom = parseServerEnv({ ...minimalDev, TOOLSY_API_BASE_URL: 'https://proxy.example/' })

    expect(fallback.success && fallback.env.TOOLSY_API_BASE_URL).toBe('https://api.toolsy.bot')
    expect(custom.success && custom.env.TOOLSY_API_BASE_URL).toBe('https://proxy.example')
  })
})
