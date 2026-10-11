'use client'

import { useState, useTransition } from 'react'

import { courseStrings } from '@/modules/course'
import type { ContentBlock } from '@/modules/course'
import { Button, Field, Input, Textarea } from '@/ui'

import { BlockEditor } from '../../_components/block-editor'
import { createLessonAction, editLessonAction } from '../_actions/course-editor'

/**
 * Форма урока.
 *
 * Название, краткое описание, длительность и конспект сохраняются одним
 * действием. Разделять их на «сохранить свойства» и «сохранить конспект»
 * было бы честнее технически и мучительнее на практике: куратор правит
 * то и другое в один заход.
 */

type LessonFormProps = {
  moduleId: string
  /** Есть — правим существующий урок, нет — создаём новый */
  lesson?: {
    id: string
    title: string
    summary: string | null
    estimatedMinutes: number | null
    isFreePreview: boolean
    content: ContentBlock[]
  }
  onDone: () => void
  onCancel: () => void
}

export function LessonForm({ moduleId, lesson, onDone, onCancel }: LessonFormProps) {
  const strings = courseStrings.manage

  const [title, setTitle] = useState(lesson?.title ?? '')
  const [summary, setSummary] = useState(lesson?.summary ?? '')
  const [minutes, setMinutes] = useState(lesson?.estimatedMinutes?.toString() ?? '')
  const [isFreePreview, setIsFreePreview] = useState(lesson?.isFreePreview ?? false)
  const [content, setContent] = useState<ContentBlock[]>(lesson?.content ?? [])

  const [fields, setFields] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(): void {
    setFields({})
    setError(null)

    const values = {
      title: title.trim(),
      summary: summary.trim() || null,
      // Пустое поле — это «неизвестно», а не «ноль минут». Ноль попал бы
      // в сумму «осталось около N минут» и молча её занизил
      estimatedMinutes: minutes.trim() ? Number(minutes) : null,
      isFreePreview,
      // Пустые блоки выбрасываем при сохранении, а не мешаем их набирать:
      // человек добавляет блок и только потом печатает
      content: content.filter(isFilled),
    }

    startTransition(async () => {
      const result = lesson
        ? await editLessonAction({ lessonId: lesson.id, values })
        : await createLessonAction({ moduleId, values })

      if (!result.ok) {
        setFields(result.fields ?? {})
        if (!result.fields) setError(result.message)
        return
      }

      onDone()
    })
  }

  return (
    <div className="border-border bg-surface-raised rounded-xl border p-5">
      <Field label={strings.lessonTitle} htmlFor="lesson-title" error={fields.title}>
        <Input id="lesson-title" value={title} onChange={(event) => setTitle(event.target.value)} />
      </Field>

      <Field label={strings.lessonSummary} htmlFor="lesson-summary" error={fields.summary}>
        <Textarea
          id="lesson-summary"
          rows={2}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
        />
      </Field>

      <Field label={strings.lessonMinutes} htmlFor="lesson-minutes" error={fields.estimatedMinutes}>
        <Input
          id="lesson-minutes"
          type="number"
          inputMode="numeric"
          value={minutes}
          onChange={(event) => setMinutes(event.target.value)}
        />
      </Field>

      <label className="text-content-muted mb-5 flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={isFreePreview}
          onChange={(event) => setIsFreePreview(event.target.checked)}
        />
        <span>
          {strings.freePreview}
          <span className="block text-xs">{strings.freePreviewHint}</span>
        </span>
      </label>

      <p className="mb-3 text-sm font-semibold">Конспект</p>
      <BlockEditor blocks={content} onChange={setContent} />

      {error ? (
        <p role="alert" className="text-danger mt-4 text-sm">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex gap-2">
        <Button onClick={submit} disabled={pending}>
          {strings.save}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={pending}>
          {strings.cancel}
        </Button>
      </div>
    </div>
  )
}

/**
 * Есть ли в блоке что сохранять.
 *
 * Куратор добавляет блок и только потом печатает; если он передумал,
 * пустой блок не должен уехать в базу и превратиться в пустое место
 * на странице урока.
 */
function isFilled(block: ContentBlock): boolean {
  switch (block.type) {
    case 'heading':
    case 'paragraph':
    case 'tip':
    case 'chords':
      return block.text.trim().length > 0
    case 'list':
      return block.items.some((item) => item.trim().length > 0)
    default:
      return true
  }
}
