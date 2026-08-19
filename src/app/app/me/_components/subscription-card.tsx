import { identityStrings } from '@/modules/identity'
import { subscriptionStrings } from '@/modules/subscription'
import type { AccessStatus } from '@/modules/subscription'
import { appConfig } from '@/shared/config/app.config'
import { Badge, Card, CardBody, CardTitle, LinkButton } from '@/ui'

/**
 * Состояние подписки.
 *
 * Отвечает на три вопроса в порядке важности: работает ли доступ прямо
 * сейчас, сколько осталось, и где продлить. Историю списаний намеренно
 * не показываем — платежи идут в боте, и дублировать их здесь значило бы
 * показывать неполную картину, которая разойдётся с настоящей.
 *
 * Отдельно про недоступный Telegram: если связи с мессенджером нет,
 * человек видит спокойное объяснение, а не тревожное «статус неизвестен».
 * Доступ при этом сохраняется — это главный принцип платформы.
 */

const strings = identityStrings.settings.subscription

type SubscriptionCardProps = {
  access: AccessStatus
  /** Куда ведёт кнопка продления */
  renewUrl: string
}

const TONE: Record<AccessStatus['status'], 'accent' | 'muted' | 'danger'> = {
  active: 'accent',
  grace: 'danger',
  expired: 'danger',
  none: 'muted',
}

export function SubscriptionCard({ access, renewUrl }: SubscriptionCardProps) {
  const tone = TONE[access.status]

  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>{strings.title}</CardTitle>
          <Badge variant={tone === 'accent' ? 'accent' : 'neutral'}>
            {subscriptionStrings.status[access.status]}
          </Badge>
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          {/* Источник неизвестен, пока не было ни одного события: у нового
              участника подписки ещё нет, и строка была бы пустой */}
          {access.source ? (
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-content-muted">{strings.sourceLabel}:</dt>
              <dd>{subscriptionStrings.source[access.source]}</dd>
            </div>
          ) : null}

          {access.hasAccess ? (
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-content-muted">{strings.untilLabel}:</dt>
              <dd>{access.daysLeft === null ? strings.unlimited : `${access.daysLeft} дн.`}</dd>
            </div>
          ) : null}
        </dl>

        {access.isInGracePeriod ? (
          <p className="border-danger text-content mt-4 border-l-2 pl-3 text-sm">
            {subscriptionStrings.graceBanner(access.daysLeft ?? 0)}
          </p>
        ) : null}

        {access.isStale ? (
          <p className="text-content-muted mt-4 text-sm">{subscriptionStrings.staleNotice}</p>
        ) : null}

        <p className="text-content-subtle mt-4 text-xs">{strings.manageNote}</p>

        <div className="mt-4">
          <LinkButton
            href={renewUrl}
            variant={access.hasAccess ? 'secondary' : 'primary'}
            size="sm"
          >
            {strings.renew}
          </LinkButton>
        </div>

        {access.status === 'active' && access.daysLeft !== null ? (
          <p className="text-content-subtle mt-3 text-xs">
            Льготный период после отмены — {appConfig.subscription.graceDays} дн.: доступ не
            пропадает в тот же миг.
          </p>
        ) : null}
      </CardBody>
    </Card>
  )
}
