import { identityStrings } from '@/modules/identity/strings'
import { routes } from '@/shared/routes'
import { Card, CardBody, CardTitle, LinkButton, PropertyList } from '@/ui'

/**
 * Как человек входит и подтверждает подписку.
 *
 * Почта показывается целиком: это экран самого человека, и ему важно
 * видеть, на какой адрес придёт код, если он войдёт с нового телефона.
 *
 * Смены почты и замены Telegram здесь нет: оба действия редкие, а ошибка
 * в них отрезает человека от аккаунта или от подписки. Пока их выполняют
 * кураторы по просьбе участника (ADR-0030, «Что дальше»).
 */
const strings = identityStrings.settings.signIn

export function SignInCard({
  email,
  telegramUsername,
  hasTelegram,
}: {
  email: string | null
  telegramUsername: string | null
  hasTelegram: boolean
}) {
  const telegram = hasTelegram
    ? telegramUsername
      ? `${strings.telegramLinked} · @${telegramUsername}`
      : strings.telegramLinked
    : strings.telegramMissing

  return (
    <Card>
      <CardBody>
        <CardTitle>{strings.title}</CardTitle>
        <p className="text-content-muted mt-1 mb-4 text-sm">{strings.description}</p>

        <PropertyList
          items={[
            { label: strings.emailLabel, value: email ?? strings.emailMissing },
            { label: strings.telegramLabel, value: telegram },
          ]}
        />

        {hasTelegram ? null : (
          <div className="mt-4">
            <LinkButton
              href={routes.auth.connectTelegram(routes.app.me.settings())}
              variant="secondary"
              size="sm"
            >
              {strings.connect}
            </LinkButton>
          </div>
        )}

        <p className="text-content-subtle mt-4 text-xs">{strings.changeNote}</p>
      </CardBody>
    </Card>
  )
}
