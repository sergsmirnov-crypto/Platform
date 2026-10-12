'use client'

import { SmilePlus } from 'lucide-react'
import { useEffect, useId, useRef, useState, useTransition } from 'react'

import { applyReaction, nextReaction, REACTION_KEYS, reactionStrings } from '@/modules/reactions'
import type { ReactionKey, ReactionSummary, ReactionTarget } from '@/modules/reactions'
import { cn, ReactionIcon } from '@/ui'

import { setReactionAction } from '../../_actions/reactions'

/**
 * Панель реакций под постом (ADR-0032).
 *
 * ─────────────────────────────────────────────────────────────────
 * КАК В TELEGRAM, НО ОДНА РЕАКЦИЯ ОТ ЧЕЛОВЕКА
 *
 * Видны только реакции, которые уже кто-то поставил, — со счётчиками.
 * Остальные — за кнопкой со смайликом. Нажатие на счётчик ставит эту
 * реакцию или снимает свою; новая заменяет прежнюю. Одна от человека —
 * это и честный счёт для адвент-календаря, где окошко открывается
 * при наборе нужного числа.
 * ─────────────────────────────────────────────────────────────────
 *
 * Результат показывается сразу, до ответа сервера: реакция — действие
 * без последствий. Сервер возвращает настоящую сводку, и она заменяет
 * догадку: за это время могли нажать и другие. Не получилось —
 * возвращаем как было и говорим об этом.
 */

type ReactionBarProps = {
  targetType: ReactionTarget
  targetId: string
  initial: ReactionSummary
}

export function ReactionBar({ targetType, targetId, initial }: ReactionBarProps) {
  const [summary, setSummary] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [isPickerOpen, setPickerOpen] = useState(false)
  const [, startTransition] = useTransition()

  const pickerId = useId()
  const rootRef = useRef<HTMLDivElement>(null)

  // Выбор закрывается кликом мимо и клавишей Escape — как любое меню
  useEffect(() => {
    if (!isPickerOpen) return

    function onPointer(event: PointerEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) setPickerOpen(false)
    }
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') setPickerOpen(false)
    }

    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [isPickerOpen])

  function press(key: ReactionKey): void {
    const before = summary
    const next = nextReaction(summary.mine, key)

    setSummary(applyReaction(summary, next))
    setPickerOpen(false)
    setError(null)

    startTransition(async () => {
      const result = await setReactionAction({ targetType, targetId, reaction: next })

      if (!result.ok) {
        setSummary(before)
        setError(result.message || reactionStrings.failed)
        return
      }

      setSummary(result.data)
    })
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="flex flex-wrap items-center gap-2">
        {summary.counts.map((item) => {
          const label = reactionStrings.labels[item.key]
          const isMine = summary.mine === item.key

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => press(item.key)}
              aria-pressed={isMine}
              aria-label={reactionStrings.countLabel(label, item.count, isMine)}
              title={label}
              className={cn(
                'flex h-9 items-center gap-1.5 rounded-full border pr-3 pl-1.5 text-sm font-medium tabular-nums transition-colors',
                isMine
                  ? 'border-accent bg-accent-soft text-content'
                  : 'border-border text-content-muted hover:border-border-strong',
              )}
            >
              <ReactionIcon name={item.key} size={24} />
              {item.count}
            </button>
          )
        })}

        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          aria-expanded={isPickerOpen}
          aria-controls={pickerId}
          aria-label={reactionStrings.add}
          title={reactionStrings.add}
          className="border-border text-content-muted hover:border-border-strong hover:text-content flex h-9 w-9 items-center justify-center rounded-full border transition-colors"
        >
          <SmilePlus size={18} aria-hidden />
        </button>
      </div>

      {isPickerOpen ? (
        <div
          id={pickerId}
          role="group"
          aria-label={reactionStrings.picker}
          className="border-border bg-surface-raised absolute top-full left-0 z-20 mt-2 grid grid-cols-5 gap-1 rounded-2xl border p-2 shadow-lg"
        >
          {REACTION_KEYS.map((key) => {
            const label = reactionStrings.labels[key]
            const isMine = summary.mine === key

            return (
              <button
                key={key}
                type="button"
                onClick={() => press(key)}
                aria-pressed={isMine}
                aria-label={label}
                title={label}
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-xl transition-transform hover:scale-110',
                  isMine && 'bg-accent-soft',
                )}
              >
                <ReactionIcon name={key} size={36} />
              </button>
            )
          })}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-danger mt-2 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  )
}
