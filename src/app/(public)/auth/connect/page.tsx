import { redirect } from 'next/navigation'

import {
  createTelegramLink,
  findTelegramIdByUserId,
  identityStrings,
  isTelegramLinkAvailable,
  safeReturnTo,
} from '@/modules/identity'
import { getSession } from '@/modules/identity/current-user'
import { RETURN_TO_PARAM } from '@/shared/config/constants'
import { routes } from '@/shared/routes'
import { LinkButton } from '@/ui'

import { ConnectTelegramPanel } from './_components/connect-telegram-panel'

/**
 * Подключение Telegram — один раз, сразу после первого входа по почте.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ВНЕ ЗАКРЫТОЙ ЗОНЫ `/app`
 *
 * Это шаг входа, а не раздел платформы: ни меню, ни шапки, ни знакомства
 * до него. Разметка закрытой зоны отправила бы новичка сперва на
 * знакомство — а после знакомства он упёрся бы в «подписки нет», хотя
 * оплатил. Порядок объяснён в `sign-in-destination.ts`.
 *
 * Сессию страница проверяет сама: публичная зона её не требует.
 * ─────────────────────────────────────────────────────────────────
 *
 * Ссылка с ключом выдаётся при каждом открытии страницы. Обновлять её
 * в ожидании «Старт» не нужно: страница спрашивает сервер отдельным
 * лёгким запросом (`checkTelegramLinkedAction`), не выпуская новых ключей.
 */

export const metadata = { title: 'Подключение Telegram' }

const strings = identityStrings.telegramLink

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ConnectTelegramPage({ searchParams }: PageProps) {
  const params = await searchParams
  const nextRaw = params[RETURN_TO_PARAM]
  const next = safeReturnTo(typeof nextRaw === 'string' ? nextRaw : null)

  const session = await getSession()

  if (!session) {
    const login = new URL(routes.home(), 'http://internal')
    login.searchParams.set(RETURN_TO_PARAM, routes.auth.connectTelegram(next))
    redirect(`${login.pathname}${login.search}`)
  }

  if (await findTelegramIdByUserId(session.user.id)) {
    redirect(next)
  }

  /*
   * «Подключу позже» ведёт на главную, а не туда, куда человек шёл:
   * если он шёл к разборам, проверка подписки вернула бы его сюда же.
   * Исключение — знакомство: оно открыто и без подписки.
   */
  const skipHref = next === routes.app.onboarding() ? next : routes.app.dashboard()

  return (
    <section className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-2xl font-bold">{strings.title}</h1>
      <p className="text-content-muted mt-3 text-sm">{strings.description}</p>

      <div className="mt-8">
        {isTelegramLinkAvailable() ? (
          <ConnectTelegramPanel link={await createTelegramLink(session.user.id)} next={next} />
        ) : (
          <p className="rounded border px-4 py-3 text-sm">{strings.unavailable}</p>
        )}
      </div>

      <div className="mt-10 border-t pt-6">
        <LinkButton href={skipHref} variant="ghost" size="sm">
          {strings.skip}
        </LinkButton>
        <p className="text-content-subtle mt-2 text-xs">{strings.skipNote}</p>
      </div>
    </section>
  )
}
