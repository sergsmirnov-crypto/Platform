import { redirect } from 'next/navigation'

import { identityStrings, isDevAuthAvailable } from '@/modules/identity'
import { getSession } from '@/modules/identity/current-user'
import { RETURN_TO_PARAM } from '@/shared/config/constants'
import { serverEnv } from '@/shared/config/env.server'
import { routes } from '@/shared/routes'
import { LinkButton } from '@/ui'

import { EmailLoginForm } from './_components/email-login-form'
import { TelegramLoginWidget } from './_components/telegram-login-widget'

/**
 * Страница входа.
 *
 * Основной вход — по коду на почту (ADR-0030). Кнопка «Войти через
 * Telegram» показывается только при TELEGRAM_LOGIN_ENABLED=true: она
 * зависит от того, открывается ли сайт Telegram в браузере участника.
 *
 * Уже вошедшего человека сразу уводим внутрь: показывать ему форму входа
 * бессмысленно и выглядит как поломка.
 */

export const metadata = { title: 'Вход в клуб' }

/** Сообщения по причинам отказа. Коды приходят из обработчика /auth/telegram и разметки */
const ERROR_MESSAGES: Record<string, string> = {
  too_many: 'Слишком много попыток входа. Попробуйте через несколько минут.',
  invalid: 'Не удалось подтвердить вход. Попробуйте ещё раз.',
  expired: 'Данные входа устарели. Нажмите кнопку входа ещё раз.',
  unavailable: 'Вход временно недоступен. Мы уже разбираемся.',
  blocked: identityStrings.errors.blocked,
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function HomePage({ searchParams }: PageProps) {
  const session = await getSession()
  if (session) {
    redirect(routes.app.dashboard())
  }

  const params = await searchParams
  const errorCode = typeof params.error === 'string' ? params.error : null
  const returnToRaw = params[RETURN_TO_PARAM]
  const returnTo = typeof returnToRaw === 'string' ? returnToRaw : null

  const botUsername = serverEnv.TELEGRAM_BOT_USERNAME
  const telegramLoginShown = serverEnv.TELEGRAM_LOGIN_ENABLED === 'true' && Boolean(botUsername)
  const authUrl = new URL(routes.auth.telegram(), serverEnv.NEXT_PUBLIC_APP_URL)
  if (returnTo) {
    authUrl.searchParams.set(RETURN_TO_PARAM, returnTo)
  }

  return (
    <section className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-3xl font-bold">Гитарный клуб</h1>
      <p className="mt-3 text-sm opacity-80">{identityStrings.emailLogin.description}</p>

      {errorCode ? (
        <p className="border-danger text-danger mt-6 rounded border px-4 py-3 text-sm">
          {ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.invalid}
        </p>
      ) : null}

      <div className="mt-8">
        <EmailLoginForm returnTo={returnTo} />
      </div>

      {telegramLoginShown && botUsername ? (
        <div className="mt-6 border-t pt-6">
          <TelegramLoginWidget botUsername={botUsername} authUrl={authUrl.toString()} />
        </div>
      ) : null}

      {isDevAuthAvailable() ? (
        <div className="mt-8 border-t pt-6">
          <p className="text-xs opacity-60">
            Для разработки: войти под любым участником, не дожидаясь кода (коды при
            EMAIL_PROVIDER=console печатаются в окне pnpm dev).
          </p>
          <div className="mt-2">
            <LinkButton href={routes.dev.login()} variant="secondary" size="sm">
              Служебный вход
            </LinkButton>
          </div>
        </div>
      ) : null}

      <p className="mt-10 text-xs opacity-60">
        Входя, вы соглашаетесь с{' '}
        <a href={routes.legal.offer()} className="underline">
          офертой
        </a>{' '}
        и{' '}
        <a href={routes.legal.privacy()} className="underline">
          политикой обработки данных
        </a>
        .
      </p>
    </section>
  )
}
