import { isLastOwner } from '@/modules/access'
import {
  findEmailByUserId,
  findProfileVisibility,
  findTelegramIdByUserId,
  findTelegramUsername,
  identityStrings,
  listDevices,
} from '@/modules/identity'
import { getSession } from '@/modules/identity/current-user'
import { getPreferences } from '@/modules/notifications/service'
import { getSetting, SETTING_KEYS } from '@/modules/settings'
import { getAccessStatus } from '@/modules/subscription'
import { routes } from '@/shared/routes'
import { Card, CardBody, CardTitle } from '@/ui'
import { ThemeToggle } from '@/ui/theme/theme-toggle'

import { PageIntro } from '../../_components/page-intro'
import { DeleteAccountCard } from '../_components/delete-account-card'
import { DevicesCard } from '../_components/devices-card'
import { LegalCard } from '../_components/legal-card'
import { NotificationSettingsCard } from '../_components/notification-settings-card'
import { SignInCard } from '../_components/sign-in-card'
import { SubscriptionCard } from '../_components/subscription-card'
import { VisibilityCard } from '../_components/visibility-card'

export const metadata = { title: 'Настройки' }

/**
 * Настройки личного кабинета.
 *
 * Порядок разделов — по частоте, с которой человек сюда приходит:
 * подписка (чаще всего — «до какого числа оплачено»), устройства,
 * оформление. Удаление аккаунта в самом низу и визуально отделено:
 * рядом с ним не должно оказаться ничего, что нажимают не глядя.
 *
 * Все данные читаются на сервере одним заходом. Раздел открыт и тем,
 * у кого подписка закончилась: именно отсюда её продлевают.
 */
export default async function SettingsPage() {
  const session = await getSession()
  if (!session) return null

  const userId = session.user.id
  const [
    access,
    devices,
    renewUrl,
    blockedFromDeletion,
    visibility,
    preferences,
    email,
    telegramId,
    telegramUsername,
  ] = await Promise.all([
    getAccessStatus(userId),
    listDevices(userId, session.sessionId),
    getSetting<string>(SETTING_KEYS.subscriptionRenewUrl),
    isLastOwner(userId),
    findProfileVisibility(userId),
    getPreferences(userId),
    findEmailByUserId(userId),
    findTelegramIdByUserId(userId),
    findTelegramUsername(userId),
  ])

  return (
    <>
      <PageIntro title="Настройки" description="Подписка, вход, визитка, устройства, оформление" />

      <div className="grid max-w-2xl gap-5">
        <SubscriptionCard
          access={access}
          // Пока ссылка не задана в настройках платформы, кнопка ведёт
          // на страницу переходов в Telegram: там человек найдёт бота сам.
          // Пустая кнопка была бы хуже неточной
          renewUrl={renewUrl || routes.app.club.telegram()}
        />

        <SignInCard
          email={email}
          hasTelegram={telegramId !== null}
          telegramUsername={telegramUsername}
        />

        {/* Видимость визитки стоит выше устройств и оформления:
            это решение о себе, а не настройка удобства */}
        <VisibilityCard visibility={visibility} />

        <DevicesCard devices={devices} />

        <Card>
          <CardBody>
            <CardTitle>{identityStrings.settings.appearance.title}</CardTitle>
            <p className="text-content-muted mt-1 mb-4 text-sm">
              {identityStrings.settings.appearance.description}
            </p>
            <ThemeToggle />
          </CardBody>
        </Card>

        <NotificationSettingsCard preferences={preferences} />

        <LegalCard />

        <DeleteAccountCard blocked={blockedFromDeletion} />
      </div>
    </>
  )
}
