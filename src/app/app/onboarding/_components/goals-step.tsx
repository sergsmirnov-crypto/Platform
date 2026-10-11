'use client'

import { useState, useTransition } from 'react'

import { ONBOARDING_GOALS } from '@/modules/identity/onboarding'
import { onboardingStrings } from '@/modules/identity/onboarding-strings'

import { saveGoalsAction, skipStepAction } from '../_actions/steps'

import { StepActions, StepShell } from './step-shell'

/**
 * Цели занятий.
 *
 * Последний вопрос и единственный, который сегодня ни на что не влияет
 * технически: разборы по целям не размечены. Он остаётся по двум причинам.
 *
 * Для человека это самый осмысленный вопрос знакомства: он проговаривает,
 * зачем пришёл, и дальше видит платформу как ответ на собственный запрос,
 * а не как чужой архив.
 *
 * Для клуба это данные, которых иначе взять неоткуда. На шаге 10.3
 * уведомления перестанут быть одинаковыми для всех: человеку с целью
 * «играть в компании» незачем письмо про новый разбор соло, а тому, кто
 * хочет разобраться в теории, — про песни у костра.
 *
 * Значения из закрытого списка, как и жанры: свободный ввод дал бы
 * «хочу играть у костра», «костёр» и «песни у костра» тремя разными целями.
 */
export function GoalsStep({
  stepIndex,
  initial,
  onDone,
}: {
  stepIndex: number
  initial: { goals: string[] }
  onDone: () => void
}) {
  const [goals, setGoals] = useState<string[]>(initial.goals)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  function toggle(value: string) {
    setGoals((current) =>
      current.includes(value) ? current.filter((goal) => goal !== value) : [...current, value],
    )
  }

  function handleSubmit() {
    setErrors({})

    startTransition(async () => {
      const result = await saveGoalsAction({ goals: goals as [], reachedStep: stepIndex + 1 })

      if (!result.ok) {
        setErrors(result.fields ?? { form: result.message })
        return
      }

      onDone()
    })
  }

  function handleSkip() {
    startTransition(async () => {
      await skipStepAction({ reachedStep: stepIndex + 1 })
      onDone()
    })
  }

  return (
    <StepShell
      title={onboardingStrings.goals.title}
      description={onboardingStrings.goals.description}
      questionNumber={4}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          handleSubmit()
        }}
      >
        {/*
          Цели в столбик, а не облаком: формулировки длинные, и в облаке
          они переносятся по-разному, из-за чего список читается рывками
        */}
        <div className="flex flex-col gap-2">
          {ONBOARDING_GOALS.map((goal) => {
            const selected = goals.includes(goal.value)

            return (
              <button
                key={goal.value}
                type="button"
                aria-pressed={selected}
                disabled={pending}
                onClick={() => toggle(goal.value)}
                className={
                  selected
                    ? 'border-accent bg-accent text-accent-content min-h-12 rounded-xl border px-4 text-left text-sm'
                    : 'border-border text-content hover:border-border-strong min-h-12 rounded-xl border px-4 text-left text-sm transition-colors'
                }
              >
                {goal.label}
              </button>
            )
          })}
        </div>

        {errors.form ? <p className="text-danger mt-4 text-sm">{errors.form}</p> : null}

        <StepActions onSkip={handleSkip} pending={pending} />
      </form>
    </StepShell>
  )
}
