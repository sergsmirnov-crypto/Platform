'use client'

import { Laptop, Smartphone, Tablet, HelpCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { endDeviceAction, endOtherDevicesAction } from '@/modules/identity/actions'
import { describeDevice, lastSeenLabel } from '@/modules/identity/devices'
import type { DeviceKind } from '@/modules/identity/devices'
import { identityStrings } from '@/modules/identity/strings'
import type { SessionDevice } from '@/modules/identity/types'
import { appConfig } from '@/shared/config/app.config'
import { Badge, Button, Card, CardBody, CardTitle } from '@/ui'

/**
 * Активные устройства.
 *
 * Экран отвечает на один вопрос: «нет ли здесь чужого входа». Поэтому
 * строка устройства сведена к тому, по чему человек узнаёт своё:
 * браузер, система и когда был последний вход. Строку, которой
 * представляется браузер, никто читать не станет.
 *
 * Текущее устройство закрыть нельзя намеренно: кнопка «выйти» живёт
 * в меню профиля, и дублировать её здесь — верный способ, чтобы человек,
 * закрывающий чужую сессию, случайно выбросил сам себя.
 */

const strings = identityStrings.settings.devices

const ICONS: Record<DeviceKind, typeof Laptop> = {
  desktop: Laptop,
  mobile: Smartphone,
  tablet: Tablet,
  unknown: HelpCircle,
}

type DevicesCardProps = {
  devices: SessionDevice[]
}

export function DevicesCard({ devices }: DevicesCardProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const hasOthers = devices.some((device) => !device.isCurrent)

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null)

    startTransition(async () => {
      const result = await action()

      if (!result.ok) {
        setError(result.message ?? 'Не получилось')
        return
      }

      router.refresh()
    })
  }

  return (
    <Card>
      <CardBody>
        <CardTitle>{strings.title}</CardTitle>
        <p className="text-content-muted mt-1 text-sm">{strings.description}</p>

        {devices.length === 0 ? (
          <p className="text-content-muted mt-4 text-sm">{strings.empty}</p>
        ) : (
          <ul className="mt-4 space-y-1">
            {devices.map((device) => {
              const description = describeDevice(device.userAgent)
              const Icon = ICONS[description.kind]

              return (
                <li
                  key={device.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg py-2 first:pt-0"
                >
                  <Icon size={20} aria-hidden className="text-content-subtle shrink-0" />

                  <div className="min-w-40 flex-1">
                    <p className="text-sm font-medium">{description.label}</p>
                    <p className="text-content-muted text-xs">
                      {identityStrings.devices.lastUsed}:{' '}
                      {lastSeenLabel(new Date(device.lastUsedAt))}
                    </p>
                  </div>

                  {device.isCurrent ? (
                    <Badge variant="outline" size="sm">
                      {identityStrings.devices.current}
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => run(() => endDeviceAction({ sessionId: device.id }))}
                    >
                      {identityStrings.devices.revoke}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {error ? (
          <p role="alert" className="text-danger mt-3 text-sm">
            {error}
          </p>
        ) : null}

        {hasOthers ? (
          <div className="mt-4">
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => run(() => endOtherDevicesAction({}))}
            >
              {strings.endOthers}
            </Button>
          </div>
        ) : null}

        <p className="text-content-subtle mt-4 text-xs">
          {strings.limitNote(appConfig.session.maxActiveDevices)}
        </p>
      </CardBody>
    </Card>
  )
}
