'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { clubStrings } from '@/modules/club'
import type { CuratorView } from '@/modules/club'
import { Button, Field, Input, Textarea } from '@/ui'

import { editCuratorCardAction } from '../_actions/curator-editor'

import { TagListInput } from './tag-list-input'

/**
 * Форма карточки куратора.
 *
 * Заполняет её сам человек — это его страница, а не карточка товара.
 * Отсюда тон подсказок: не «введите значение», а «как пришёл к гитаре,
 * чему учит, чего ждёт от учеников».
 *
 * Обязательных полей нет ни одного. Карточка заводится скрытой,
 * заполняется по частям — сегодня строчка о себе, через неделю
 * оборудование, — и требовать всё сразу значило бы получить пустые
 * страницы у всех троих.
 */
export function CuratorForm({ curator }: { curator: CuratorView }) {
  const strings = clubStrings.manage
  const router = useRouter()

  const [headline, setHeadline] = useState(curator.headline ?? '')
  const [bio, setBio] = useState(curator.bio ?? '')
  const [teaches, setTeaches] = useState(curator.teaches)
  const [influences, setInfluences] = useState(curator.influences)
  const [gear, setGear] = useState(curator.gear)
  const [teachingSince, setTeachingSince] = useState(
    curator.teachingSince ? String(curator.teachingSince) : '',
  )

  const [fields, setFields] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  function submit(): void {
    setFields({})
    setError(null)
    setSaved(false)

    const year = teachingSince.trim() ? Number.parseInt(teachingSince, 10) : null

    if (year !== null && Number.isNaN(year)) {
      setFields({ teachingSince: 'Укажите год числом' })
      return
    }

    startTransition(async () => {
      const result = await editCuratorCardAction({
        userId: curator.userId,
        values: {
          headline: headline.trim() || null,
          bio: bio.trim() || null,
          teaches,
          influences,
          gear,
          teachingSince: year,
        },
      })

      if (!result.ok) {
        setFields(result.fields ?? {})
        if (!result.fields) setError(result.message)
        return
      }

      setSaved(true)
      router.refresh()
    })
  }

  return (
    <div className="border-border bg-surface-raised rounded-xl border p-5">
      <Field label={strings.fields.headline} htmlFor="curator-headline" error={fields.headline}>
        <Input
          id="curator-headline"
          value={headline}
          onChange={(event) => setHeadline(event.target.value)}
          placeholder="Фингерстайл и акустика"
        />
        <p className="text-content-subtle mt-1 text-xs">{strings.fields.headlineHint}</p>
      </Field>

      <Field label={strings.fields.bio} htmlFor="curator-bio" error={fields.bio}>
        <Textarea
          id="curator-bio"
          rows={8}
          value={bio}
          onChange={(event) => setBio(event.target.value)}
        />
        <p className="text-content-subtle mt-1 text-xs">{strings.fields.bioHint}</p>
      </Field>

      <TagListInput
        label={strings.fields.teaches}
        hint={strings.fields.teachesHint}
        values={teaches}
        onChange={setTeaches}
      />

      <TagListInput
        label={strings.fields.influences}
        values={influences}
        onChange={setInfluences}
      />

      <TagListInput label={strings.fields.gear} values={gear} onChange={setGear} />

      <Field
        label={strings.fields.teachingSince}
        htmlFor="curator-since"
        error={fields.teachingSince}
      >
        <Input
          id="curator-since"
          inputMode="numeric"
          className="max-w-32"
          value={teachingSince}
          onChange={(event) => setTeachingSince(event.target.value)}
          placeholder="2014"
        />
        <p className="text-content-subtle mt-1 text-xs">{strings.fields.teachingSinceHint}</p>
      </Field>

      {error ? (
        <p role="alert" className="text-danger mt-4 text-sm">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={submit} disabled={pending}>
          {strings.save}
        </Button>

        {saved ? <span className="text-content-muted text-sm">{strings.saved}</span> : null}
      </div>
    </div>
  )
}
