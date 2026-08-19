'use client'

import { ArrowDown, ArrowUp, Eye, FileText, Plus, Video } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { courseStrings } from '@/modules/course'
import type { ContentBlock } from '@/modules/course'
import { routes } from '@/shared/routes'
import { Badge, Button, Dialog, EmptyState, Field, Input, Textarea } from '@/ui'

import {
  createModuleAction,
  deleteLessonAction,
  deleteModuleAction,
  editModuleAction,
  reorderLessonsAction,
  reorderModulesAction,
  setLessonPublishedAction,
  setModulePublishedAction,
} from '../_actions/course-editor'

import { LessonForm } from './lesson-form'

/**
 * Дерево курса.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОРЯДОК КНОПКАМИ, А НЕ ПЕРЕТАСКИВАНИЕМ
 *
 * То же решение и по тем же причинам, что у частей разбора: перетаскивание
 * требует библиотеки, ломается на сенсорном экране внутри прокрутки
 * и недоступно с клавиатуры. Модулей в курсе восемь, уроков в модуле
 * пять, переставляют их редко.
 * ─────────────────────────────────────────────────────────────────
 *
 * Правка происходит прямо здесь, на месте: куратор не уходит на отдельную
 * страницу урока и не теряет из виду, где этот урок стоит в курсе.
 */

export type TreeLesson = {
  id: string
  slug: string
  title: string
  summary: string | null
  estimatedMinutes: number | null
  isFreePreview: boolean
  status: string
  hasVideo: boolean
  blockCount: number
  content: ContentBlock[]
}

export type TreeModule = {
  id: string
  slug: string
  title: string
  description: string | null
  status: string
  lessons: TreeLesson[]
}

export function CourseTree({ modules }: { modules: TreeModule[] }) {
  const router = useRouter()
  const strings = courseStrings.manage

  const [addingModule, setAddingModule] = useState(false)
  const [pending, startTransition] = useTransition()

  function moveModule(index: number, direction: -1 | 1): void {
    const target = index + direction
    if (target < 0 || target >= modules.length) return

    const ids = modules.map((module) => module.id)
    const current = ids[index] as string
    ids[index] = ids[target] as string
    ids[target] = current

    startTransition(async () => {
      await reorderModulesAction({ ids })
      router.refresh()
    })
  }

  return (
    <div>
      {modules.length === 0 && !addingModule ? (
        <EmptyState
          title={strings.empty}
          description={strings.emptyHint}
          action={<Button onClick={() => setAddingModule(true)}>{strings.addModule}</Button>}
          className="border-border rounded-lg border border-dashed"
        />
      ) : (
        <ol className="space-y-4">
          {modules.map((module, index) => (
            <ModuleNode
              key={module.id}
              module={module}
              index={index}
              total={modules.length}
              busy={pending}
              onMove={moveModule}
              onChanged={() => router.refresh()}
            />
          ))}
        </ol>
      )}

      {addingModule ? (
        <div className="mt-4">
          <ModuleForm
            onDone={() => {
              setAddingModule(false)
              router.refresh()
            }}
            onCancel={() => setAddingModule(false)}
          />
        </div>
      ) : modules.length > 0 ? (
        <Button variant="secondary" className="mt-4" onClick={() => setAddingModule(true)}>
          <Plus size={16} aria-hidden />
          {strings.addModule}
        </Button>
      ) : null}
    </div>
  )
}

function ModuleNode({
  module,
  index,
  total,
  busy,
  onMove,
  onChanged,
}: {
  module: TreeModule
  index: number
  total: number
  busy: boolean
  onMove: (index: number, direction: -1 | 1) => void
  onChanged: () => void
}) {
  const strings = courseStrings.manage

  const [editing, setEditing] = useState(false)
  const [addingLesson, setAddingLesson] = useState(false)
  const [editingLesson, setEditingLesson] = useState<TreeLesson | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [pending, startTransition] = useTransition()

  const isPublished = module.status === 'published'

  function togglePublished(): void {
    startTransition(async () => {
      await setModulePublishedAction({ moduleId: module.id, published: !isPublished })
      onChanged()
    })
  }

  function moveLesson(position: number, direction: -1 | 1): void {
    const target = position + direction
    if (target < 0 || target >= module.lessons.length) return

    const ids = module.lessons.map((lesson) => lesson.id)
    const current = ids[position] as string
    ids[position] = ids[target] as string
    ids[target] = current

    startTransition(async () => {
      await reorderLessonsAction({ ids })
      onChanged()
    })
  }

  return (
    <li className="border-border bg-surface-raised rounded-xl border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            {index + 1}. {module.title}
            {!isPublished ? <Badge variant="draft">Черновик</Badge> : null}
          </p>
          {module.description ? (
            <p className="text-content-muted mt-1 text-sm">{module.description}</p>
          ) : null}
          <p className="text-content-muted mt-1 text-sm">
            {module.lessons.length > 0
              ? strings.lessonsCount(module.lessons.length)
              : strings.noLessons}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            aria-label={strings.moveUp}
            disabled={busy || index === 0}
            onClick={() => onMove(index, -1)}
          >
            <ArrowUp size={16} aria-hidden />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={strings.moveDown}
            disabled={busy || index === total - 1}
            onClick={() => onMove(index, 1)}
          >
            <ArrowDown size={16} aria-hidden />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)} disabled={pending}>
            {strings.edit}
          </Button>
          <Button size="sm" variant="ghost" onClick={togglePublished} disabled={pending}>
            {isPublished ? strings.unpublish : strings.publish}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirmRemove(true)}
            disabled={pending}
          >
            {strings.remove}
          </Button>
        </div>
      </div>

      {editing ? (
        <div className="mt-4">
          <ModuleForm
            module={module}
            onDone={() => {
              setEditing(false)
              onChanged()
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : null}

      <ul className="mt-4 space-y-2">
        {module.lessons.map((lesson, position) => (
          <li key={lesson.id}>
            {editingLesson?.id === lesson.id ? (
              <LessonForm
                moduleId={module.id}
                lesson={lesson}
                onDone={() => {
                  setEditingLesson(null)
                  onChanged()
                }}
                onCancel={() => setEditingLesson(null)}
              />
            ) : (
              <LessonRow
                lesson={lesson}
                moduleSlug={module.slug}
                position={position}
                total={module.lessons.length}
                busy={pending}
                onMove={moveLesson}
                onEdit={() => setEditingLesson(lesson)}
                onChanged={onChanged}
              />
            )}
          </li>
        ))}
      </ul>

      {addingLesson ? (
        <div className="mt-3">
          <LessonForm
            moduleId={module.id}
            onDone={() => {
              setAddingLesson(false)
              onChanged()
            }}
            onCancel={() => setAddingLesson(false)}
          />
        </div>
      ) : (
        <Button size="sm" variant="ghost" className="mt-3" onClick={() => setAddingLesson(true)}>
          <Plus size={16} aria-hidden />
          {strings.addLesson}
        </Button>
      )}

      <Dialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title="Удалить модуль?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRemove(false)}>
              {strings.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                startTransition(async () => {
                  await deleteModuleAction({ moduleId: module.id })
                  setConfirmRemove(false)
                  onChanged()
                })
              }
            >
              {strings.remove}
            </Button>
          </>
        }
      >
        <p className="text-content-muted text-sm">
          {strings.confirmRemoveModule(module.lessons.length)}
        </p>
      </Dialog>
    </li>
  )
}

function LessonRow({
  lesson,
  moduleSlug,
  position,
  total,
  busy,
  onMove,
  onEdit,
  onChanged,
}: {
  lesson: TreeLesson
  moduleSlug: string
  position: number
  total: number
  busy: boolean
  onMove: (position: number, direction: -1 | 1) => void
  onEdit: () => void
  onChanged: () => void
}) {
  const strings = courseStrings.manage

  const [confirmRemove, setConfirmRemove] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const isPublished = lesson.status === 'published'

  function togglePublished(): void {
    setError(null)

    startTransition(async () => {
      const result = await setLessonPublishedAction({
        lessonId: lesson.id,
        published: !isPublished,
        hasVideo: lesson.hasVideo,
        blockCount: lesson.blockCount,
      })

      if (!result.ok) {
        setError(result.fields?.content ?? result.message)
        return
      }

      onChanged()
    })
  }

  return (
    <div className="border-border rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-3">
        {lesson.hasVideo ? (
          <Video size={16} className="text-content-subtle shrink-0" aria-hidden />
        ) : (
          <FileText size={16} className="text-content-subtle shrink-0" aria-hidden />
        )}

        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{lesson.title}</span>
          <span className="text-content-muted block text-xs">
            {lesson.blockCount > 0 ? strings.blocksCount(lesson.blockCount) : strings.emptyLesson}
            {lesson.estimatedMinutes ? ` · ${lesson.estimatedMinutes} мин` : ''}
            {lesson.isFreePreview ? ' · открыт всем' : ''}
          </span>
        </span>

        {!isPublished ? <Badge variant="draft">Черновик</Badge> : null}

        <span className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            aria-label={strings.moveUp}
            disabled={busy || position === 0}
            onClick={() => onMove(position, -1)}
          >
            <ArrowUp size={16} aria-hidden />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={strings.moveDown}
            disabled={busy || position === total - 1}
            onClick={() => onMove(position, 1)}
          >
            <ArrowDown size={16} aria-hidden />
          </Button>

          {/* Ссылка на страницу урока: куратор смотрит результат там же,
              где его увидит участник, а не в предпросмотре, который
              всегда чуть-чуть отличается */}
          <Link
            href={routes.app.learn.lesson(moduleSlug, lesson.slug)}
            className="text-content-muted hover:text-content inline-flex size-9 items-center justify-center rounded-lg"
            aria-label={strings.openForMembers}
          >
            <Eye size={16} aria-hidden />
          </Link>

          <Button size="sm" variant="ghost" onClick={onEdit} disabled={pending}>
            {strings.edit}
          </Button>
          <Button size="sm" variant="ghost" onClick={togglePublished} disabled={pending}>
            {isPublished ? strings.unpublish : strings.publish}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirmRemove(true)}
            disabled={pending}
          >
            {strings.remove}
          </Button>
        </span>
      </div>

      {error ? (
        <p role="alert" className="text-danger mt-2 text-sm">
          {error}
        </p>
      ) : null}

      <Dialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title="Удалить урок?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRemove(false)}>
              {strings.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                startTransition(async () => {
                  await deleteLessonAction({ lessonId: lesson.id })
                  setConfirmRemove(false)
                  onChanged()
                })
              }
            >
              {strings.remove}
            </Button>
          </>
        }
      >
        <p className="text-content-muted text-sm">{strings.confirmRemoveLesson}</p>
      </Dialog>
    </div>
  )
}

function ModuleForm({
  module,
  onDone,
  onCancel,
}: {
  module?: TreeModule
  onDone: () => void
  onCancel: () => void
}) {
  const strings = courseStrings.manage

  const [title, setTitle] = useState(module?.title ?? '')
  const [description, setDescription] = useState(module?.description ?? '')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  function submit(): void {
    setFields({})
    const values = { title: title.trim(), description: description.trim() || null }

    startTransition(async () => {
      const result = module
        ? await editModuleAction({ moduleId: module.id, values })
        : await createModuleAction(values)

      if (!result.ok) {
        setFields(result.fields ?? {})
        return
      }

      onDone()
    })
  }

  return (
    <div className="border-border rounded-xl border border-dashed p-4">
      <Field label={strings.moduleTitle} htmlFor="module-title" error={fields.title}>
        <Input id="module-title" value={title} onChange={(event) => setTitle(event.target.value)} />
      </Field>

      <Field label={strings.moduleDescription} htmlFor="module-description">
        <Textarea
          id="module-description"
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>

      <div className="flex gap-2">
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
