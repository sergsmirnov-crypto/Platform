'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { mediaStrings } from '@/modules/media'
import type { EditorMaterial } from '@/modules/media'
import { LEVELS, SECTION_TEMPLATES } from '@/modules/songs'
import type { PublicationStatus } from '@/shared/db/enums'
import { Badge, Button, Field, Input, Textarea } from '@/ui'

import { MaterialsEditor } from '../../../_components/materials-editor'
import {
  attachVideoAction,
  createArrangementAction,
  deleteArrangementAction,
  saveArrangementAction,
  setArrangementPublishedAction,
} from '../../_actions/song-editor'

import { SectionEditor } from './section-editor'

/**
 * Варианты разбора и всё, что внутри них.
 *
 * Каждый вариант — свёрнутая карточка, раскрывающаяся по нажатию.
 * У песни бывает три-четыре варианта, у каждого шесть частей: развернув
 * всё сразу, куратор получил бы страницу в три экрана прокрутки, на которой
 * невозможно найти нужное. Раскрыт всегда ровно один.
 */

type Arrangement = {
  id: string
  level: 'beginner' | 'intermediate' | 'advanced'
  title: string | null
  summary: string | null
  estimatedMinutes: number | null
  status: PublicationStatus
  videoExternalId: string | null
  sections: {
    id: string
    title: string
    description: string | null
    orderIndex: number
    videoStartSec: number | null
    videoEndSec: number | null
  }[]
}

type ArrangementEditorProps = {
  songId: string
  /** Страница песни у участника — её надо перечитать после правки */
  publicPath: string
  arrangements: Arrangement[]
  /** Материалы каждого варианта, по его идентификатору */
  materials: Record<string, EditorMaterial[]>
  canPublish: boolean
  canDelete: boolean
  canUpload: boolean
}

export function ArrangementEditor({
  songId,
  publicPath,
  arrangements,
  materials,
  canPublish,
  canDelete,
  canUpload,
}: ArrangementEditorProps) {
  const router = useRouter()
  const [openId, setOpenId] = useState<string | null>(arrangements[0]?.id ?? null)
  const [adding, setAdding] = useState(arrangements.length === 0)

  return (
    <div className="space-y-4">
      {arrangements.map((arrangement) => (
        <ArrangementCard
          key={arrangement.id}
          arrangement={arrangement}
          isOpen={openId === arrangement.id}
          onToggle={() => setOpenId(openId === arrangement.id ? null : arrangement.id)}
          onChanged={() => router.refresh()}
          publicPath={publicPath}
          materials={materials[arrangement.id] ?? []}
          canPublish={canPublish}
          canDelete={canDelete}
          canUpload={canUpload}
        />
      ))}

      {adding ? (
        <NewArrangement
          songId={songId}
          onDone={() => {
            setAdding(false)
            router.refresh()
          }}
          onCancel={arrangements.length === 0 ? undefined : () => setAdding(false)}
        />
      ) : (
        <Button variant="secondary" onClick={() => setAdding(true)}>
          Добавить вариант
        </Button>
      )}
    </div>
  )
}

function ArrangementCard({
  arrangement,
  isOpen,
  onToggle,
  onChanged,
  publicPath,
  materials,
  canPublish,
  canDelete,
  canUpload,
}: {
  arrangement: Arrangement
  isOpen: boolean
  onToggle: () => void
  onChanged: () => void
  publicPath: string
  materials: EditorMaterial[]
  canPublish: boolean
  canDelete: boolean
  canUpload: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [level, setLevel] = useState<string>(arrangement.level)
  const [title, setTitle] = useState(arrangement.title ?? '')
  const [summary, setSummary] = useState(arrangement.summary ?? '')
  const [minutes, setMinutes] = useState(
    arrangement.estimatedMinutes === null ? '' : String(arrangement.estimatedMinutes),
  )
  const [videoId, setVideoId] = useState(arrangement.videoExternalId ?? '')

  function save() {
    setErrors({})
    startTransition(async () => {
      const result = await saveArrangementAction({
        arrangementId: arrangement.id,
        values: { level, title, summary, estimatedMinutes: minutes },
      })

      if (!result.ok) {
        setErrors(result.fields ?? { form: result.message })
        return
      }

      const video = await attachVideoAction({
        arrangementId: arrangement.id,
        externalId: videoId,
      })

      if (!video.ok) setErrors({ videoId: video.message })
      else onChanged()
    })
  }

  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="hover:bg-surface-hover flex w-full items-center gap-3 p-4 text-left transition-colors"
      >
        <span className="flex-1 font-medium">
          {LEVELS.find((item) => item.value === arrangement.level)?.label}
          {arrangement.title ? ` · ${arrangement.title}` : ''}
        </span>

        <span className="text-content-muted text-sm">{arrangement.sections.length} частей</span>

        <Badge variant={arrangement.status === 'published' ? 'outline' : 'draft'} size="sm">
          {arrangement.status === 'published' ? 'Опубликован' : 'Черновик'}
        </Badge>
      </button>

      {isOpen ? (
        <div className="border-border space-y-6 border-t p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Уровень" htmlFor={`level-${arrangement.id}`} error={errors.level}>
              <select
                id={`level-${arrangement.id}`}
                value={level}
                onChange={(event) => setLevel(event.target.value)}
                className="bg-surface border-border h-12 w-full rounded-md border px-4 text-base"
              >
                {LEVELS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Название варианта"
              htmlFor={`title-${arrangement.id}`}
              hint="«На акустике», «Фингерстайл»"
              error={errors.title}
            >
              <Input
                id={`title-${arrangement.id}`}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </Field>
          </div>

          <Field
            label="Что освоит участник"
            htmlFor={`summary-${arrangement.id}`}
            error={errors.summary}
          >
            <Textarea
              id={`summary-${arrangement.id}`}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Времени на разбор"
              htmlFor={`minutes-${arrangement.id}`}
              hint="Минут — сколько уйдёт у участника, а не длина видео"
              error={errors.estimatedMinutes}
            >
              <Input
                id={`minutes-${arrangement.id}`}
                inputMode="numeric"
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
              />
            </Field>

            {/* Ролик кладётся в панели хостинга — привычным куратору
                способом. Через нас идут только файлы: видео у нас
                не хранится и храниться не должно (ADR-0016) */}
            <Field
              label="Идентификатор ролика"
              htmlFor={`video-${arrangement.id}`}
              hint="Загрузите видео в Kinescope и вставьте его ID"
              error={errors.videoId}
            >
              <Input
                id={`video-${arrangement.id}`}
                value={videoId}
                onChange={(event) => setVideoId(event.target.value)}
                placeholder="pcFNnQGsD59CMKte2SQQaz"
              />
            </Field>
          </div>

          {errors.form ? <p className="text-danger text-sm">{errors.form}</p> : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={save} disabled={pending}>
              {pending ? 'Сохраняю…' : 'Сохранить вариант'}
            </Button>

            {canPublish ? (
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await setArrangementPublishedAction({
                      arrangementId: arrangement.id,
                      published: arrangement.status !== 'published',
                    })
                    onChanged()
                  })
                }
              >
                {arrangement.status === 'published' ? 'Снять с публикации' : 'Опубликовать вариант'}
              </Button>
            ) : null}

            {canDelete ? (
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  if (confirm('Удалить вариант вместе со всеми его частями?')) {
                    startTransition(async () => {
                      await deleteArrangementAction({ arrangementId: arrangement.id })
                      onChanged()
                    })
                  }
                }}
              >
                Удалить
              </Button>
            ) : null}
          </div>

          <div className="border-border border-t pt-6">
            <h3 className="mb-1 text-sm font-semibold">{mediaStrings.editor.title}</h3>
            <p className="text-content-muted mb-4 text-sm">{mediaStrings.editor.hint}</p>

            <MaterialsEditor
              entityType="arrangement"
              entityId={arrangement.id}
              publicPath={publicPath}
              materials={materials}
              canUpload={canUpload}
            />
          </div>

          <div className="border-border border-t pt-6">
            <SectionEditor
              arrangementId={arrangement.id}
              sections={arrangement.sections}
              onChanged={onChanged}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Новый вариант.
 *
 * Шаблон структуры выбирается сразу: создать шесть частей руками — это
 * две минуты, помноженные на каждый разбор. При переносе архива из двухсот
 * позиций разница набегает в часы.
 */
function NewArrangement({
  songId,
  onDone,
  onCancel,
}: {
  songId: string
  onDone: () => void
  onCancel?: (() => void) | undefined
}) {
  const [pending, startTransition] = useTransition()
  const [level, setLevel] = useState<string>('intermediate')
  const [template, setTemplate] = useState<string>('standard')
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="border-border space-y-5 rounded-lg border border-dashed p-5">
      <Field label="Уровень" htmlFor="new-level">
        <select
          id="new-level"
          value={level}
          onChange={(event) => setLevel(event.target.value)}
          className="bg-surface border-border h-12 w-full rounded-md border px-4 text-base sm:max-w-64"
        >
          {LEVELS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </Field>

      <fieldset>
        <legend className="text-content mb-2 block text-sm font-medium">Структура</legend>

        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ...SECTION_TEMPLATES,
            { value: 'empty', label: 'С нуля', hint: 'Части добавлю сам' },
          ].map((item) => (
            <label
              key={item.value}
              className={
                template === item.value
                  ? 'border-accent bg-surface-hover cursor-pointer rounded-lg border p-3'
                  : 'border-border hover:border-border-strong cursor-pointer rounded-lg border p-3'
              }
            >
              <input
                type="radio"
                name="template"
                value={item.value}
                checked={template === item.value}
                onChange={() => setTemplate(item.value)}
                className="sr-only"
              />
              <span className="block font-medium">{item.label}</span>
              <span className="text-content-muted block text-sm">{item.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {error ? <p className="text-danger text-sm">{error}</p> : null}

      <div className="flex items-center gap-3">
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await createArrangementAction({
                songId,
                values: { level, title: '', summary: '', estimatedMinutes: '' },
                template,
              })

              if (!result.ok) setError(result.message)
              else onDone()
            })
          }
        >
          {pending ? 'Создаю…' : 'Создать вариант'}
        </Button>

        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={pending}>
            Отмена
          </Button>
        ) : null}
      </div>
    </div>
  )
}
