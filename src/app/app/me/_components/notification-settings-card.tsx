'use client'

import { useState, useTransition } from 'react'

import { notificationStrings } from '@/modules/notifications'
import type { ResolvedPreference } from '@/modules/notifications'
import { Badge, Card, CardBody, CardTitle } from '@/ui'

import { setNotificationPreferenceAction } from '../../_actions/notifications'

/**
 * Что присылать в Telegram.
 *
 * ─────────────────────────────────────────────────────────────────
 * НАСТРОЙКА УПРАВЛЯЕТ ДОСТАВКОЙ, А НЕ СУЩЕСТВОВАНИЕМ
 *
 * Выключенный тип не перестаёт происходить: разбор всё так же выходит,
 * и в ленте на платформе он появится. Настройка решает только, писать
 * ли об этом в мессенджер.
 *
 * Сказано прямо в описании раздела: иначе человек, отключивший всё,
 * решит, что клуб замолчал, — и уйдёт, ни разу не открыв ленту.
 * ─────────────────────────────────────────────────────────────────
 *
 * Каждый переключатель сохраняется сам, без кнопки «Сохранить»:
 * настроек четыре, и общая кнопка означала бы, что человек, закрывший
 * страницу после нажатия, ничего не изменил.
 */
export function NotificationSettingsCard({
  preferences: initial,
}: {
  preferences: ResolvedPreference[]
}) {
  const [preferences, setPreferences] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function toggle(type: string, enabled: boolean): void {
    setError(null)

    // Показываем сразу: настройка без последствий, и ждать ответа
    // сервера ради галочки человеку незачем
    setPreferences((current) =>
      current.map((item) => (item.key === type ? { ...item, enabled } : item)),
    )

    startTransition(async () => {
      const result = await setNotificationPreferenceAction({ type, enabled })

      if (!result.ok) {
        setPreferences(initial)
        setError(result.message || notificationStrings.settings.failed)
        return
      }

      setPreferences(result.data.preferences)
    })
  }

  return (
    <Card>
      <CardBody>
        <CardTitle>{notificationStrings.settings.title}</CardTitle>
        <p className="text-content-muted mt-1 mb-4 text-sm">
          {notificationStrings.settings.description}
        </p>

        <ul className="divide-border divide-y">
          {preferences.map((item) => (
            <li key={item.key} className="flex items-center gap-4 py-3">
              <div className="min-w-0 flex-1">
                <span className="block font-medium">{item.title}</span>
                <span className="text-content-muted block text-sm">{item.description}</span>
              </div>

              {item.canDisable ? (
                <label className="flex shrink-0 cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="accent-accent h-5 w-5"
                    checked={item.enabled}
                    disabled={pending}
                    onChange={(event) => toggle(item.key, event.target.checked)}
                    aria-label={item.title}
                  />
                </label>
              ) : (
                <Badge variant="outline" size="sm">
                  {notificationStrings.settings.always}
                </Badge>
              )}
            </li>
          ))}
        </ul>

        {error ? (
          <p role="alert" className="text-danger mt-3 text-sm">
            {error}
          </p>
        ) : null}
      </CardBody>
    </Card>
  )
}
