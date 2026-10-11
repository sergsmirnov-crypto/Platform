import 'server-only'

import { serverEnv } from '@/shared/config/env.server'

import { consoleSender } from './console-sender'
import { createSmtpSender } from './smtp-sender'

import type { EmailSender } from './types'

/**
 * Отправитель писем, выбранный настройками.
 *
 * Импортируется явным путём, а не из `@/shared/email`: он читает
 * секретные настройки и работает только на сервере.
 *
 *     import { getEmailSender } from '@/shared/email/sender'
 */

let cached: EmailSender | null = null

export function getEmailSender(): EmailSender {
  if (cached) return cached

  if (serverEnv.EMAIL_PROVIDER === 'console') {
    cached = consoleSender
    return cached
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM } = serverEnv

  // Полнота набора проверяется при запуске (`env.schema.ts`). Здесь
  // повторная проверка нужна строгим типам, а не логике
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !EMAIL_FROM) {
    throw new Error('Отправка писем по SMTP не настроена: задайте SMTP_* и EMAIL_FROM')
  }

  cached = createSmtpSender({
    host: SMTP_HOST,
    port: SMTP_PORT,
    user: SMTP_USER,
    password: SMTP_PASSWORD,
    from: EMAIL_FROM,
  })

  return cached
}
