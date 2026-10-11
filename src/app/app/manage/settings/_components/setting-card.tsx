'use client'

import { useState, useTransition } from 'react'

import { settingsStrings } from '@/modules/settings/strings'
import { Button } from '@/ui'

import { resetSettingAction, saveSettingAction } from '../_actions/settings'

/**
 * Обвязка вокруг одной настройки: заголовок, пояснение, кнопки, состояние.
 *
 * ─────────────────────────────────────────────────────────────────
 * СОХРАНЕНИЕ КНОПКОЙ, А НЕ НА ЛЕТУ
 *
 * В остальных местах платформы изменения применяются сразу — здесь
 * нарочно иначе. Текст правят абзацами: человек стирает предложение,
 * думает, пишет заново. Сохранение на каждое нажатие клавиши означало
 * бы, что промежуточный обрывок фразы успел побывать на живой странице
 * у всех участников.
 * ─────────────────────────────────────────────────────────────────
 *
 * Возврат к исходному тексту нужен ровно тогда, когда правили-правили
 * и испортили: вспомнить, как было, обычно уже невозможно.
 */

type Props = {
  settingKey: 'telegram.chats' | 'subscription.renew_url' | 'club.about'
  title: string
  hint: string
  children: React.ReactNode
  /** Что отправить на сервер при нажатии «Сохранить» */
  getValue: () => unknown
  /** Можно ли вернуть исходный текст */
  resettable?: boolean
}

export function SettingCard({
  settingKey,
  title,
  hint,
  children,
  getValue,
  resettable = true,
}: Props) {
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save() {
    setStatus('idle')
    setMessage(null)

    startTransition(async () => {
      const result = await saveSettingAction({ key: settingKey, value: getValue() })

      if (!result.ok) {
        setStatus('error')
        setMessage(result.message)
        return
      }

      setStatus('saved')
    })
  }

  function reset() {
    if (!globalThis.confirm(settingsStrings.resetConfirm)) return

    startTransition(async () => {
      const result = await resetSettingAction({ key: settingKey })

      if (!result.ok) {
        setStatus('error')
        setMessage(result.message)
        return
      }

      // Значения полей приходят с сервера, поэтому после сброса нужна
      // перезагрузка: иначе на экране останется то, что уже стёрто
      globalThis.location.reload()
    })
  }

  return (
    <section className="border-border rounded-lg border p-5">
      <header className="mb-4">
        <h2 className="font-medium">{title}</h2>
        <p className="text-content-muted mt-1 text-sm">{hint}</p>
      </header>

      <div className="space-y-4">{children}</div>

      <footer className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={pending}>
          {settingsStrings.save}
        </Button>

        {resettable ? (
          <Button variant="ghost" size="sm" onClick={reset} disabled={pending}>
            {settingsStrings.reset}
          </Button>
        ) : null}

        {status === 'saved' ? (
          <span className="text-content-muted text-sm">{settingsStrings.saved}</span>
        ) : null}

        {status === 'error' && message ? (
          <span className="text-danger text-sm">{message}</span>
        ) : null}
      </footer>
    </section>
  )
}
