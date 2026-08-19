'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { fromClubInputValue, streamStrings, toClubInputValue } from '@/modules/streams'
import { routes } from '@/shared/routes'
import { Button, Field, Input, Textarea } from '@/ui'

import { createStreamAction, editStreamAction } from '../_actions/stream-editor'

/**
 * Свойства эфира: тема, описание, время, ведущий, ссылка.
 *
 * ─────────────────────────────────────────────────────────────────
 * ВРЕМЯ ВВОДИТСЯ ВСЕГДА МОСКОВСКОЕ
 *
 * Обычное поле выбора даты работает в поясе устройства. Куратор
 * в отпуске за границей назначил бы эфир не на тот час и узнал бы
 * об этом от участников.
 *
 * Поэтому значение проходит через `toClubInputValue` и обратно,
 * а рядом с полем написано, что время московское. Двух полей
 * «время и пояс» нет намеренно: пояс у клуба один, и выбор из списка
 * поясов — это приглашение ошибиться.
 * ─────────────────────────────────────────────────────────────────
 *
 * Форма одна на создание и на правку. Различие сводится к тому, какое
 * действие вызвать и куда уйти после сохранения; заводить ради этого
 * два почти одинаковых файла — верный способ поправить один и забыть
 * про второй.
 */

type Curator = { id: string; displayName: string }

type StreamFormProps = {
  curators: Curator[]
  /** Есть — правим существующий эфир, нет — создаём новый */
  stream?: {
    id: string
    title: string
    description: string | null
    startsAt: Date
    curatorId: string | null
    joinUrl: string | null
  }
  /** Кого поставить ведущим по умолчанию у нового эфира */
  defaultCuratorId?: string | null
}

export function StreamForm({ curators, stream, defaultCuratorId = null }: StreamFormProps) {
  const strings = streamStrings.manage
  const router = useRouter()

  const [title, setTitle] = useState(stream?.title ?? '')
  const [description, setDescription] = useState(stream?.description ?? '')
  const [startsAt, setStartsAt] = useState(
    stream ? toClubInputValue(stream.startsAt) : defaultStart(),
  )
  const [curatorId, setCuratorId] = useState(stream?.curatorId ?? defaultCuratorId ?? '')
  const [joinUrl, setJoinUrl] = useState(stream?.joinUrl ?? '')

  const [fields, setFields] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  function submit(): void {
    setFields({})
    setError(null)
    setSaved(false)

    const date = fromClubInputValue(startsAt)

    if (!date) {
      setFields({ startsAt: 'Укажите дату и время начала' })
      return
    }

    const values = {
      title: title.trim(),
      description: description.trim() || null,
      startsAt: date,
      curatorId: curatorId || null,
      joinUrl: joinUrl.trim() || null,
    }

    startTransition(async () => {
      // Ветки разделены, а не сведены к одному вызову: у создания
      // и правки разные ответы — идентификатор нового эфира и признак
      // сохранения, — и разное продолжение
      if (stream) {
        const result = await editStreamAction({ streamId: stream.id, values })

        if (!result.ok) {
          setFields(result.fields ?? {})
          if (!result.fields) setError(result.message)
          return
        }

        setSaved(true)
        router.refresh()
        return
      }

      const result = await createStreamAction(values)

      if (!result.ok) {
        setFields(result.fields ?? {})
        if (!result.fields) setError(result.message)
        return
      }

      // Новый эфир сразу открывается в редакторе: следующее, что нужно
      // куратору, — приложить запись или оглавление, и возвращать его
      // в список ради лишнего нажатия незачем
      router.push(routes.app.manage.stream(result.data.id))
    })
  }

  return (
    <div className="border-border bg-surface-raised rounded-xl border p-5">
      <Field label={strings.fields.title} htmlFor="stream-title" error={fields.title}>
        <Input
          id="stream-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Разбор ошибок: бой и ритм"
        />
        <p className="text-content-subtle mt-1 text-xs">{strings.fields.titleHint}</p>
      </Field>

      <Field
        label={strings.fields.description}
        htmlFor="stream-description"
        error={fields.description}
      >
        <Textarea
          id="stream-description"
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <p className="text-content-subtle mt-1 text-xs">{strings.fields.descriptionHint}</p>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={strings.fields.startsAt} htmlFor="stream-starts" error={fields.startsAt}>
          <Input
            id="stream-starts"
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
          />
          <p className="text-content-subtle mt-1 text-xs">{strings.fields.startsAtHint}</p>
        </Field>

        <Field label={strings.fields.curator} htmlFor="stream-curator" error={fields.curatorId}>
          <select
            id="stream-curator"
            value={curatorId}
            onChange={(event) => setCuratorId(event.target.value)}
            className="border-border bg-surface text-content h-11 w-full rounded-lg border px-3 text-sm"
          >
            <option value="">{strings.fields.noCurator}</option>
            {curators.map((curator) => (
              <option key={curator.id} value={curator.id}>
                {curator.displayName}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label={strings.fields.joinUrl} htmlFor="stream-join" error={fields.joinUrl}>
        <Input
          id="stream-join"
          type="url"
          inputMode="url"
          value={joinUrl}
          onChange={(event) => setJoinUrl(event.target.value)}
          placeholder="https://t.me/..."
        />
        <p className="text-content-subtle mt-1 text-xs">{strings.fields.joinUrlHint}</p>
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

        {saved ? <span className="text-content-muted text-sm">Сохранено</span> : null}
      </div>
    </div>
  )
}

/**
 * Время по умолчанию у нового эфира: ближайшая суббота, восемь вечера.
 *
 * Не «сейчас»: эфир не назначают на текущую минуту, и куратору пришлось
 * бы менять и дату, и час. Клуб собирается по выходным вечером —
 * подставленное значение чаще всего остаётся как есть.
 */
function defaultStart(): string {
  const now = new Date()
  const daysUntilSaturday = (6 - now.getDay() + 7) % 7 || 7
  const saturday = new Date(now.getTime() + daysUntilSaturday * 24 * 60 * 60 * 1000)

  return `${toClubInputValue(saturday).slice(0, 10)}T20:00`
}
