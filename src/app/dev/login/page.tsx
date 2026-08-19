import { notFound } from 'next/navigation'

import { findAllUsersForDevelopment, identityStrings, isDevAuthAvailable } from '@/modules/identity'

import { DevSignInForm } from './_components/dev-sign-in-form'

/**
 * Служебный вход для разработки.
 *
 * Виджет входа Telegram работает только на домене, зарегистрированном
 * у бота, поэтому на `localhost` войти по-настоящему нельзя. Эта страница
 * закрывает дыру: она открывает сессию под существующим участником,
 * минуя Telegram.
 *
 * В производственной сборке страницы не существует — она отвечает 404
 * ещё до обращения к базе.
 */

export const metadata = { title: 'Служебный вход' }

export default async function DevLoginPage() {
  if (!isDevAuthAvailable()) {
    notFound()
  }

  const users = await findAllUsersForDevelopment()

  return (
    <section className="mx-auto max-w-2xl px-6 py-10">
      <p className="text-xs tracking-wide uppercase opacity-60">Только разработка</p>
      <h1 className="mt-1 text-2xl font-bold">{identityStrings.devSignIn.title}</h1>
      <p className="mt-3 text-sm opacity-80">{identityStrings.devSignIn.description}</p>

      <div className="mt-6">
        {users.length === 0 ? (
          <p className="rounded border px-4 py-3 text-sm opacity-80">
            {identityStrings.devSignIn.empty}
          </p>
        ) : (
          <DevSignInForm users={users} />
        )}
      </div>
    </section>
  )
}
