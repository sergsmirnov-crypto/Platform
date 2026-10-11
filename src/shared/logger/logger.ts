import 'server-only'

import pino from 'pino'

import { serverEnv } from '@/shared/config/env.server'

/**
 * Журнал приложения.
 *
 * Записи структурные (в формате JSON), а не строки: по ним можно искать
 * и строить оповещения. При разработке вывод дополнительно раскрашивается
 * и становится читаемым глазами.
 *
 * Правило без исключений: **в журнал не попадают секреты и персональные
 * данные**. Ключи сессий, токены, пароли, адреса почты и IP вырезаются
 * автоматически — см. список ниже. Полагаться на внимательность нельзя:
 * рано или поздно кто-нибудь запишет в журнал весь объект запроса целиком.
 */

/** Поля, значения которых заменяются на [скрыто] на любом уровне вложенности */
const REDACTED_PATHS = [
  'token',
  'tokenHash',
  'password',
  'secret',
  'authorization',
  'cookie',
  'sessionToken',
  'apiKey',
  'ip',
  'email',
  'phone',
  '*.token',
  '*.password',
  '*.secret',
  '*.authorization',
  '*.cookie',
  '*.apiKey',
  'req.headers.cookie',
  'req.headers.authorization',
]

export const logger = pino({
  level: serverEnv.NODE_ENV === 'production' ? 'info' : 'debug',

  redact: {
    paths: REDACTED_PATHS,
    censor: '[скрыто]',
  },

  // При разработке — читаемый цветной вывод. В производстве — JSON,
  // потому что его разбирают программы, а не люди.
  ...(serverEnv.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }
    : {}),

  base: { env: serverEnv.NODE_ENV },
})

export type Logger = typeof logger
