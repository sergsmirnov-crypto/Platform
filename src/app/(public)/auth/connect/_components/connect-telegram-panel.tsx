'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'

import { identityStrings } from '@/modules/identity/strings'
import type { TelegramLink } from '@/modules/identity/telegram-link'
import { appConfig } from '@/shared/config/app.config'
import { Button, buttonVariants, cn } from '@/ui'

import { checkTelegramLinkedAction } from '../../../_actions/auth'

/**
 * Кнопка «Открыть бота» и ожидание подтверждения.
 *
 * Пока человек в Telegram, страница раз в несколько секунд спрашивает
 * сервер, не подключился ли он. Как только да — сама ведёт дальше:
 * человеку, вернувшемуся из Telegram, не нужно ничего нажимать.
 *
 * Опрос идёт только пока вкладка на экране: в свёрнутом браузере
 * спрашивать незачем, а на телефоне это расход батареи. Возвращение
 * на вкладку проверяет сразу — это и есть момент «вернулся из Telegram».
 */

const strings = identityStrings.telegramLink

/** Как часто спрашивать сервер */
const POLL_INTERVAL_MS = 3000
/** Сколько ждать: после этого ключ в ссылке всё равно устареет */
const WAIT_LIMIT_MS = appConfig.auth.telegramLinkLifetimeMinutes * 60 * 1000

export function ConnectTelegramPanel({ link, next }: { link: TelegramLink; next: string }) {
  const router = useRouter()
  const [opened, setOpened] = useState(false)
  const [expired, setExpired] = useState(false)
  const [pending, startTransition] = useTransition()
  const done = useRef(false)

  const check = useCallback(async () => {
    if (done.current) return

    const result = await checkTelegramLinkedAction(undefined)

    if (result.ok && result.data.linked) {
      done.current = true
      router.replace(next)
    }
  }, [next, router])

  useEffect(() => {
    // Отсчёт с момента появления страницы: ключ в ссылке выдан тогда же
    const startedAt = Date.now()

    function tick() {
      if (Date.now() - startedAt > WAIT_LIMIT_MS) {
        setExpired(true)
        return
      }
      if (document.visibilityState === 'visible') void check()
    }

    const timer = setInterval(tick, POLL_INTERVAL_MS)
    const onVisible = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [check])

  if (expired) {
    return <p className="rounded border px-4 py-3 text-sm">{strings.expired}</p>
  }

  return (
    <div>
      <ol className="text-content mb-6 list-decimal space-y-1.5 pl-5 text-sm">
        {strings.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ fullWidth: true }))}
        onClick={() => setOpened(true)}
      >
        {strings.open}
      </a>

      {/*
        Запасной путь: прямо в приложение, минуя сайт t.me. Нужен, когда
        сайт t.me в браузере не открывается, а приложение работает
      */}
      <p className="text-content-subtle mt-2 text-center text-xs">
        <a href={link.appUrl} className="underline" onClick={() => setOpened(true)}>
          {strings.openInApp}
        </a>
      </p>

      {opened ? (
        <div className="mt-6 text-center">
          <p className="text-content-muted text-sm" aria-live="polite">
            {strings.waiting}
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3"
            disabled={pending}
            onClick={() => startTransition(check)}
          >
            {strings.check}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
