'use client'

import { useState, useTransition } from 'react'

import { onboardingStrings } from '@/modules/identity/onboarding-strings'
import { routes } from '@/shared/routes'

import { acceptDocumentsAction } from '../_actions/steps'

import { StepShell } from './step-shell'

/**
 * Согласие с офертой и политикой данных.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЕДИНСТВЕННЫЙ ШАГ, КОТОРЫЙ НЕЛЬЗЯ ПРОПУСТИТЬ
 *
 * Остальные вопросы — про человека, и не отвечать на них он вправе.
 * Согласие — правовое условие пользования платформой: без него у нас нет
 * основания обрабатывать его данные и оказывать услугу.
 *
 * Флажок не отмечен заранее. Предустановленное согласие юридически
 * не является согласием, и это не формальность: смысл записи в том, что
 * человек совершил действие.
 * ─────────────────────────────────────────────────────────────────
 *
 * Ссылки на документы открываются в новой вкладке. Иначе человек уйдёт
 * читать оферту и вернётся кнопкой «Назад» — на шаг, который к тому
 * моменту уже не помнит состояния флажка.
 */
export function ConsentStep({
  stepIndex,
  isReturningMember,
  onDone,
}: {
  stepIndex: number
  /** Участник, вошедший до появления знакомства: ему нужно объяснение */
  isReturningMember: boolean
  onDone: () => void
}) {
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit() {
    if (!accepted) {
      setError(onboardingStrings.consent.required)
      return
    }

    setError(null)

    startTransition(async () => {
      const result = await acceptDocumentsAction({ accepted: true, reachedStep: stepIndex + 1 })

      if (!result.ok) {
        setError(result.message)
        return
      }

      onDone()
    })
  }

  return (
    <StepShell
      title={onboardingStrings.consent.title}
      description={onboardingStrings.consent.description}
      questionNumber={null}
    >
      <p className="text-content-muted -mt-4 mb-6">{onboardingStrings.consent.lead}</p>

      {isReturningMember ? (
        <p className="border-border text-content-muted mb-6 rounded border px-4 py-3 text-sm">
          {onboardingStrings.consent.returning}
        </p>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault()
          handleSubmit()
        }}
      >
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => {
              setAccepted(event.target.checked)
              if (event.target.checked) setError(null)
            }}
            className="accent-accent mt-1 size-5 shrink-0"
          />
          <span className="text-sm">{onboardingStrings.consent.checkbox}</span>
        </label>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 pl-8 text-sm">
          <a
            href={routes.legal.offer()}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {onboardingStrings.consent.offerLink}
          </a>
          <a
            href={routes.legal.privacy()}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {onboardingStrings.consent.privacyLink}
          </a>
        </div>

        {error ? <p className="text-danger mt-4 text-sm">{error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="bg-accent text-accent-content mt-8 min-h-11 w-full rounded-full px-6 text-sm font-medium disabled:opacity-50 sm:w-auto"
        >
          {pending ? onboardingStrings.saving : onboardingStrings.consent.submit}
        </button>
      </form>
    </StepShell>
  )
}
