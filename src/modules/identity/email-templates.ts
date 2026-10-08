import { appConfig } from '@/shared/config/app.config'
import type { EmailMessage } from '@/shared/email'
import { plural } from '@/shared/utils/plural'

/**
 * Письмо с кодом входа.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ПИСЬМО ТАКОЕ СКУПОЕ
 *
 * Код стоит в теме письма: на экране блокировки телефона видна только
 * тема, и человек переписывает цифры, не открывая почту. Это главное
 * удобство всего способа входа.
 *
 * Ни логотипа, ни ссылок, ни картинок. Почтовые сервисы относятся
 * к письмам с картинками и ссылками от нового отправителя подозрительно,
 * а письмо с кодом в спаме — это человек, который не может войти.
 * ─────────────────────────────────────────────────────────────────
 */
export function loginCodeEmail(input: {
  to: string
  code: string
  lifetimeMinutes: number
}): EmailMessage {
  const minutes = `${input.lifetimeMinutes} ${plural(input.lifetimeMinutes, 'минуту', 'минуты', 'минут')}`

  const text = [
    `Код для входа: ${input.code}`,
    '',
    `Введите его на странице входа. Код действует ${minutes}.`,
    '',
    'Если вы не пытались войти, просто не обращайте внимания на это письмо: ' +
      'без кода войти в ваш аккаунт нельзя.',
    '',
    appConfig.name,
  ].join('\n')

  const html = `<!doctype html>
<html lang="ru">
  <body style="font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #1a1a1a; line-height: 1.5;">
    <p>Код для входа:</p>
    <p style="font-size: 32px; font-weight: 700; letter-spacing: 6px; margin: 8px 0 16px;">${input.code}</p>
    <p>Введите его на странице входа. Код действует ${minutes}.</p>
    <p style="color: #666; font-size: 14px;">Если вы не пытались войти, просто не обращайте внимания на это письмо: без кода войти в ваш аккаунт нельзя.</p>
    <p style="color: #666; font-size: 14px;">${appConfig.name}</p>
  </body>
</html>`

  return {
    to: input.to,
    subject: `${input.code} — код для входа в ${appConfig.name}`,
    text,
    html,
  }
}
