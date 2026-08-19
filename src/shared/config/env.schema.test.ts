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
