import { redirect } from 'next/navigation'

import { identityStrings, isDevAuthAvailable } from '@/modules/identity'
import { getSession } from '@/modules/identity/current-user'
import { RETURN_TO_PARAM } from '@/shared/config/constants'
import { serverEnv } from '@/shared/config/env.server'
import { routes } from '@/shared/routes'
import { LinkButton } from '@/ui'

import { TelegramLoginWidget } from './_components/telegram-login-widget'

/**
 * Страница входа.
 *
 * Пока это простой экран: настоящий лендинг с рассказом о клубе появится
 * позже. Задача этого шага — работающий вход, а не оформление.
 *
 * Уже вошедшего человека сразу уводим внутрь: показывать ему кнопку входа
 * бессмысленно и выглядит как поломка.
 */

export const metadata = { title: 'Вход в клуб' }

/** Сообщения по причинам отказа. Коды приходят из обработчика /auth/telegram */
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
  const authUrl = new URL(routes.auth.telegram(), serverEnv.NEXT_PUBLIC_APP_URL)
  if (returnTo) {
    authUrl.searchParams.set(RETURN_TO_PARAM, returnTo)
  }

  return (
    <section className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-3xl font-bold">Гитарный клуб</h1>
      <p className="mt-3 text-sm opacity-80">
        Закрытая платформа для участников клуба: разборы песен, курс, записи эфиров.
      </p>

      {errorCode ? (
        <p className="border-danger text-danger mt-6 rounded border px-4 py-3 text-sm">
          {ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.invalid}
        </p>
      ) : null}

      <div className="mt-8">
        {botUsername ? (
          <TelegramLoginWidget botUsername={botUsername} authUrl={authUrl.toString()} />
        ) : (
          <p className="rounded border px-4 py-3 text-sm opacity-80">
            Вход через Telegram не настроен: не задано имя бота (TELEGRAM_BOT_USERNAME).
          </p>
        )}
      </div>

      {isDevAuthAvailable() ? (
        <div className="mt-8 border-t pt-6">
          <p className="text-xs opacity-60">
            Виджет Telegram работает только на настоящем домене. Для разработки:
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
