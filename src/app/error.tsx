'use client'

import { useEffect } from 'react'

import { routes } from '@/shared/routes'
import { Button, LinkButton, PageHeader } from '@/ui'

/**
 * Экран, который видит человек, когда страница не смогла отрисоваться.
 *
 * Правила текста: объясняем, что произошло и что делать. Не извиняемся,
 * не пишем «упс», не показываем технических подробностей — они не помогут
 * гитаристу и могут раскрыть устройство системы.
 *
 * Идентификатор происшествия показываем: по нему мы за секунду находим
 * причину в журнале, если человек напишет в чат.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <PageHeader
        eyebrow="Ошибка"
        title="Страница не загрузилась"
        description="Это сбой на нашей стороне, а не у вас. Попробуйте обновить — обычно помогает."
      />
      <div className="flex flex-wrap gap-3">
        <Button onClick={reset}>Обновить страницу</Button>
        <LinkButton href={routes.app.dashboard()} variant="secondary">
          На главную
        </LinkButton>
      </div>
      {error.digest ? (
        <p className="text-content-muted mt-8 text-sm">
          Если повторится, пришлите этот код в чат клуба:{' '}
          <code className="text-content font-mono">{error.digest}</code>
        </p>
      ) : null}
    </main>
  )
}
