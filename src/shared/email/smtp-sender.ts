import 'server-only'

import { createTransport } from 'nodemailer'

import { errors } from '@/shared/errors'
import { logger } from '@/shared/logger'

import type { EmailMessage, EmailSender } from './types'
import type { Transporter } from 'nodemailer'

/**
 * Отправка писем по SMTP.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ SMTP, А НЕ API КОНКРЕТНОГО СЕРВИСА
 *
 * SMTP — общий язык всех сервисов рассылки: российских и зарубежных,
 * платных и встроенных в почту на домене. Выбор сервиса остаётся
 * решением о деньгах и надёжности доставки, а не о коде: переезд —
 * это четыре строки в настройках сервера.
 *
 * API отдельного сервиса дал бы статистику доставки и шаблоны в его
 * панели. Для одного письма с кодом это не нужно.
 * ─────────────────────────────────────────────────────────────────
 */

export type SmtpSettings = {
  host: string
  port: number
  user: string
  password: string
  from: string
}

/**
 * Сколько ждём почтовый сервер. Человек стоит перед экраном «отправляем
 * код» — дольше пятнадцати секунд он ждать не станет
 */
const TIMEOUT_MS = 15_000

export function createSmtpSender(settings: SmtpSettings): EmailSender {
  // Соединение создаётся один раз и переиспользуется между письмами
  const transport: Transporter = createTransport({
    host: settings.host,
    port: settings.port,
    // 465 — защищённое соединение с первого байта. На остальных портах
    // соединение переводится в защищённое командой STARTTLS
    secure: settings.port === 465,
    requireTLS: settings.port !== 465,
    auth: { user: settings.user, pass: settings.password },
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  })

  return {
    async send(message: EmailMessage): Promise<void> {
      try {
        await transport.sendMail({
          from: settings.from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
        })
      } catch (cause) {
        // Адрес получателя в журнал не пишется: это персональные данные
        logger.warn({ err: cause }, 'письмо не отправлено: почтовый сервер недоступен или отказал')
        throw errors.upstream('email', cause)
      }
    },
  }
}
