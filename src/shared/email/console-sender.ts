import { logger } from '@/shared/logger'

import type { EmailMessage, EmailSender } from './types'

/**
 * Отправитель для разработки: письмо не уходит, а печатается в журнал.
 *
 * Нужен по той же причине, что и служебный вход: без него разработчику
 * пришлось бы заводить учётную запись почтового сервиса, чтобы просто
 * войти на платформу у себя на компьютере. Код входа виден в окне,
 * где запущен `pnpm dev`.
 *
 * На боевом сервере этот отправитель запрещён проверкой настроек
 * при запуске (`env.schema.ts`): там коды в журнале означали бы,
 * что войти не может никто.
 */
export const consoleSender: EmailSender = {
  async send(message: EmailMessage): Promise<void> {
    logger.info(
      { to: message.to, subject: message.subject },
      `письмо не отправлено (EMAIL_PROVIDER=console):\n\n${message.text}\n`,
    )
  },
}
