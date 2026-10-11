'use server'

import { z } from 'zod'

import {
  cleanCodeInput,
  findTelegramIdByUserId,
  requestLoginCode,
  safeReturnTo,
  signInDestination,
  signInWithLoginCode,
} from '@/modules/identity'
import { getRequestOrigin, setSessionCookie } from '@/modules/identity/cookie'
import { getSession } from '@/modules/identity/current-user'
import { identityStrings } from '@/modules/identity/strings'
import { getAccessStatus } from '@/modules/subscription'
import { appConfig } from '@/shared/config/app.config'
import { emailSchema } from '@/shared/email'
import { errors } from '@/shared/errors'
import { routes } from '@/shared/routes'
import { defineAction } from '@/shared/server'

/**
 * Действия входа по почте и подключения Telegram.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ЗДЕСЬ, А НЕ В МОДУЛЕ `identity`
 *
 * Куда отправить человека после входа, зависит от двух модулей:
 * подключён ли Telegram (`identity`) и есть ли доступ (`subscription`).
 * Складывать ответы разных модулей в поведение — работа слоя приложения,
 * так же как в проверках доступа страниц (`app/app/_lib/guards.ts`).
 * Модуль `identity` при этом не начинает зависеть от подписок.
 * ─────────────────────────────────────────────────────────────────
 *
 * Перенаправление возвращается адресом, а не выполняется здесь:
 * `redirect` внутри `defineAction` принимается обёрткой за ошибку
 * (см. `signOutAndRedirect`). Страницу открывает форма.
 */

const codeSchema = z
  .string({ error: identityStrings.emailLogin.errors.codeFormat })
  .transform(cleanCodeInput)
  .pipe(
    z.string().regex(new RegExp(`^\\d{${appConfig.auth.codeLength}}$`), {
      error: identityStrings.emailLogin.errors.codeFormat,
    }),
  )

export const requestLoginCodeAction = defineAction({
  name: 'identity.requestLoginCode',
  input: z.object({ email: emailSchema }),
  handler: async ({ email }) => requestLoginCode(email, await getRequestOrigin()),
})

export const verifyLoginCodeAction = defineAction({
  name: 'identity.verifyLoginCode',
  input: z.object({
    email: emailSchema,
    code: codeSchema,
    returnTo: z.string().max(2000).nullish(),
  }),
  handler: async ({ email, code, returnTo }) => {
    const signedIn = await signInWithLoginCode(email, code, await getRequestOrigin())
    await setSessionCookie(signedIn.token, signedIn.expiresAt)

    const userId = signedIn.user.id
    const [telegramId, access] = await Promise.all([
      findTelegramIdByUserId(userId),
      getAccessStatus(userId),
    ])

    const destination = signInDestination(
      {
        isNewUser: signedIn.isNewUser,
        hasTelegram: telegramId !== null,
        hasAccess: access.hasAccess,
        returnTo: safeReturnTo(returnTo),
      },
      { connectTelegram: routes.auth.connectTelegram, onboarding: routes.app.onboarding() },
    )

    return { destination }
  },
})

/**
 * Подключён ли уже Telegram.
 *
 * Страница подключения спрашивает это раз в несколько секунд, пока
 * человек нажимает «Старт» в боте: так она узнаёт, что можно идти дальше,
 * и человеку не нужно ничего обновлять руками.
 */
export const checkTelegramLinkedAction = defineAction({
  name: 'identity.checkTelegramLinked',
  handler: async () => {
    const session = await getSession()
    if (!session) throw errors.unauthorized()

    return { linked: (await findTelegramIdByUserId(session.user.id)) !== null }
  },
})
