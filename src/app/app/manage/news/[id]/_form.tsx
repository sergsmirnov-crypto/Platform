'use client'

import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { isValidDiscussionUrl, NEWS_KINDS, newsStrings } from '@/modules/news'
import type { NewsKind } from '@/modules/news'
import type { ContentBlocks } from '@/shared/blocks'
import { routes } from '@/shared/routes'
import { Button, cn, Input, Textarea } from '@/ui'

import { BlockEditor } from '../../_components/block-editor'
import { deleteNewsAction, publishNewsAction, saveNewsAction } from '../_actions/news-editor'

/**
 * Редактор новости.
 *
 * ─────────────────────────────────────────────────────────────────
 * ОДНА ФОРМА, А НЕ МАСТЕР ИЗ ШАГОВ
 *
 * Пост — это вид, заголовок, выжимка и текст. Разбивать несколько полей
 * на шаги было бы издевательством; редактор разбора устроен мастером
 * потому, что там пятнадцать полей и структура частей.
 * ─────────────────────────────────────────────────────────────────
 *
 * Публикация отделена от сохранения. Куратор часто пишет новость
 * в два захода — начал утром, дописал вечером; сохранение, которое
 * заодно публикует, отправило бы половину текста всему клубу.
 */

type NewsFormProps = {
  id: string
  slug: string
  initialTitle: string
  initialExcerpt: string
  initialPinned: boolean
  /** «До какого дня» закреплено, ГГГГ-ММ-ДД; пусто — без срока */
  initialPinnedUntilDay: string
  initialKind: NewsKind
  initialDiscussionUrl: string
  initialContent: ContentBlocks
  isPublished: boolean
  canPublish: boolean
  canDelete: boolean
}

export function NewsForm({
  id,
  slug,
  initialTitle,
  initialExcerpt,
  initialPinned,
  initialPinnedUntilDay,
  initialKind,
  initialDiscussionUrl,
  initialContent,
  isPublished,
  canPublish,
  canDelete,
}: NewsFormProps) {
  const router = useRouter()

  const [title, setTitle] = useState(initialTitle)
  const [excerpt, setExcerpt] = useState(initialExcerpt)
  const [isPinned, setIsPinned] = useState(initialPinned)
  const [pinnedUntilDay, setPinnedUntilDay] = useState(initialPinnedUntilDay)
  const [kind, setKind] = useState<NewsKind>(initialKind)
  const [discussionUrl, setDiscussionUrl] = useState(initialDiscussionUrl)
  const [content, setContent] = useState(initialContent)

  // Та же проверка, что на сервере: ошибку видно до нажатия «Сохранить»
  const discussionInvalid =
    discussionUrl.trim() !== '' && !isValidDiscussionUrl(discussionUrl.trim())

  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function save(): void {
    setError(null)
    setMessage(null)

    startTransition(async () => {
      const result = await saveNewsAction({
        id,
        title,
        excerpt: excerpt.trim() || null,
        isPinned,
        pinnedUntilDay: isPinned && pinnedUntilDay ? pinnedUntilDay : null,
        kind,
        discussionUrl: discussionUrl.trim() || null,
        content,
      })

      if (!result.ok) {
        setError(result.message || newsStrings.manage.failed)
        return
      }

      setMessage(newsStrings.manage.saved)
      router.refresh()
    })
  }

  function togglePublished(): void {
    setError(null)

    startTransition(async () => {
      const result = await publishNewsAction({ id, published: !isPublished })

      if (!result.ok) {
        setError(result.message || newsStrings.manage.failed)
        return
      }

      router.refresh()
    })
  }

  function remove(): void {
    // Восстановить нечем: у новостей нет архива, в отличие от разборов.
    // Разбор с прогрессом участников удалять насовсем нельзя, а объявление
    // о встрече, которая прошла, — можно и нужно
    if (!globalThis.confirm('Удалить новость? Восстановить будет нельзя')) return

    startTransition(async () => {
      const result = await deleteNewsAction({ id })

      if (!result.ok) {
        setError(result.message || newsStrings.manage.failed)
        return
      }

      router.push(routes.app.manage.news())
    })
  }

  return (
    <div className="max-w-3xl space-y-6">
      <fieldset>
        <legend className="mb-2 block text-sm font-medium">{newsStrings.manage.kindField}</legend>
        <div className="flex flex-wrap gap-2">
          {NEWS_KINDS.map((option) => (
            <label
              key={option}
              className={cn(
                'flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm transition-colors',
                'has-[:focus-visible]:ring-accent has-[:focus-visible]:ring-2',
                kind === option
                  ? 'border-accent bg-accent text-accent-content'
                  : 'border-border text-content-muted hover:border-border-strong',
              )}
            >
              <input
                type="radio"
                name="news-kind"
                value={option}
                checked={kind === option}
                onChange={() => setKind(option)}
                className="sr-only"
              />
              {newsStrings.kinds[option]}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="news-title" className="mb-1 block text-sm font-medium">
          {newsStrings.manage.titleField}
        </label>
        <Input
          id="news-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
        />
      </div>

      <div>
        <label htmlFor="news-excerpt" className="mb-1 block text-sm font-medium">
          {newsStrings.manage.excerptField}
        </label>
        <Textarea
          id="news-excerpt"
          value={excerpt}
          onChange={(event) => setExcerpt(event.target.value)}
          rows={2}
          maxLength={500}
        />
        <p className="text-content-muted mt-1 text-sm">{newsStrings.manage.excerptHint}</p>
      </div>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="accent-accent mt-1 h-5 w-5"
          checked={isPinned}
          onChange={(event) => setIsPinned(event.target.checked)}
        />
        <span>
          <span className="block font-medium">{newsStrings.manage.pinnedField}</span>
          <span className="text-content-muted block text-sm">{newsStrings.manage.pinnedHint}</span>
        </span>
      </label>

      {isPinned ? (
        <div className="pl-8">
          <label htmlFor="news-pinned-until" className="mb-1 block text-sm font-medium">
            {newsStrings.manage.pinnedUntilField}
          </label>
          <Input
            id="news-pinned-until"
            type="date"
            value={pinnedUntilDay}
            onChange={(event) => setPinnedUntilDay(event.target.value)}
            className="max-w-xs"
          />
          <p className="text-content-muted mt-1 text-sm">{newsStrings.manage.pinnedUntilHint}</p>
        </div>
      ) : null}

      <div>
        <label htmlFor="news-discussion" className="mb-1 block text-sm font-medium">
          {newsStrings.manage.discussionField}
        </label>
        <Input
          id="news-discussion"
          type="url"
          inputMode="url"
          placeholder="https://t.me/…"
          value={discussionUrl}
          onChange={(event) => setDiscussionUrl(event.target.value)}
          aria-invalid={discussionInvalid}
          aria-describedby="news-discussion-hint"
          maxLength={500}
        />
        <p
          id="news-discussion-hint"
          className={cn('mt-1 text-sm', discussionInvalid ? 'text-danger' : 'text-content-muted')}
        >
          {discussionInvalid
            ? 'Нужна ссылка на сообщение в Telegram: https://t.me/…'
            : newsStrings.manage.discussionHint}
        </p>
      </div>

      <BlockEditor blocks={content} onChange={setContent} />

      <div className="border-border flex flex-wrap items-center gap-3 border-t pt-4">
        <Button onClick={save} disabled={pending || discussionInvalid}>
          {newsStrings.manage.save}
        </Button>

        {canPublish ? (
          <Button onClick={togglePublished} disabled={pending} variant="secondary">
            {isPublished ? newsStrings.manage.unpublish : newsStrings.manage.publish}
          </Button>
        ) : null}

        <a
          href={routes.app.club.newsPost(slug)}
          target="_blank"
          rel="noreferrer"
          className="text-content-muted hover:text-content text-sm"
        >
          Посмотреть как участник
        </a>

        <span className="flex-1" />

        {canDelete ? (
          <Button onClick={remove} disabled={pending} variant="ghost" size="sm">
            <Trash2 size={16} aria-hidden />
            Удалить
          </Button>
        ) : null}
      </div>

      {message ? <p className="text-content-muted text-sm">{message}</p> : null}
      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
    </div>
  )
}
