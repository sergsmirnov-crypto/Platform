'use client'

import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { newsStrings } from '@/modules/news'
import { routes } from '@/shared/routes'
import { Button, Input } from '@/ui'

/**
 * Создание новости.
 *
 * Спрашивается только заголовок — всё остальное правится в редакторе.
 * Так же устроено создание разбора и эфира: человек попадает
 * в редактор и правит то, что видит, вместо того чтобы заранее
 * угадывать поля пустой формы.
 */
export function CreateNewsButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function create(): void {
    setError(null)

    startTransition(async () => {
      const { createNewsAction } = await import('../_actions/news-editor')
      const result = await createNewsAction({ title })

      if (!result.ok) {
        setError(result.message || newsStrings.manage.failed)
        return
      }

      router.push(routes.app.manage.newsPost(result.data.id))
    })
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm">
        <Plus size={16} aria-hidden />
        {newsStrings.manage.create}
      </Button>
    )
  }

  return (
    <div className="flex flex-wrap items-start gap-2">
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') create()
        }}
        placeholder={newsStrings.manage.titleField}
        maxLength={200}
        aria-label={newsStrings.manage.titleField}
        autoFocus
      />

      <Button onClick={create} disabled={pending || title.trim().length === 0} size="sm">
        {newsStrings.manage.create}
      </Button>

      {error ? (
        <p role="alert" className="text-danger w-full text-sm">
          {error}
        </p>
      ) : null}
    </div>
  )
}
