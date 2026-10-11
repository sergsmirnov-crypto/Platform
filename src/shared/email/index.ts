/**
 * Электронная почта: проверка адресов и отправка писем.
 *
 * Слой инфраструктуры: умеет отправить письмо, но не знает, о чём оно.
 * Тексты писем живут в модулях, которые их отправляют.
 *
 * Отправитель (`sender.ts`) отсюда намеренно не реэкспортируется:
 * он читает секретные настройки и работает только на сервере.
 * Импортируется явно:
 *
 *     import { getEmailSender } from '@/shared/email/sender'
 */
export { emailSchema, maskEmail, MAX_EMAIL_LENGTH, normalizeEmail } from './address'
export type { EmailMessage, EmailSender } from './types'
