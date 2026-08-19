'use client'

import { useState, useTransition } from 'react'

import { onboardingStrings } from '@/modules/identity/onboarding-strings'
import { Field, Input } from '@/ui'

import { saveNameAction, skipStepAction } from '../_actions/steps'

import { StepActions, StepShell } from './step-shell'

/**
 * Имя и город.
 *
 * Имя предзаполнено из Telegram, поэтому шаг чаще всего проходится одним
 * нажатием «Дальше». Это осознанно: первый вопрос должен быть лёгким.
 * Форма, которая начинается с пустого обязательного поля, читается как
 * анкета, а анкету заполняют неохотно.
 *
 * Фотографии здесь нет, хотя в замысле она была на этом шаге. Найти файл,
 * обрезать и дождаться загрузки — самое долгое действие знакомства, и при
 * цели «первое видео за пять минут» именно на нём человек и уходит.
 * Фотография переехала в список «Освойся в клубе» на главной, а аватар
 * из Telegram уже есть — безликим участник не выглядит.
 */
export function NameStep({
  stepIndex,
  initial,
  onDone,
}: {
  stepIndex: number
  initial: { displayName: string; city: string | null }
  onDone: () => void
}) {
  const [displayName, setDisplayName] = useState(initial.displayName)
  const [city, setCity] = useState(initial.city ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  function handleSubmit() {
    setErrors({})

    startTransition(async () => {
      const result = await saveNameAction({
        displayName,
        city,
        reachedStep: stepIndex + 1,
      })

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
      title={onboardingStrings.name.title}
      description={onboardingStrings.name.description}
      questionNumber={1}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          handleSubmit()
        }}
      >
        <Field
          label={onboardingStrings.name.nameLabel}
          htmlFor="displayName"
          error={errors.displayName}
          hint={onboardingStrings.name.prefilled}
        >
          <Input
            id="displayName"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder={onboardingStrings.name.namePlaceholder}
            disabled={pending}
            autoFocus
          />
        </Field>

        <Field label={onboardingStrings.name.cityLabel} htmlFor="city" error={errors.city}>
          <Input
            id="city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder={onboardingStrings.name.cityPlaceholder}
            disabled={pending}
          />
        </Field>

        {errors.form ? <p className="text-danger text-sm">{errors.form}</p> : null}

        <StepActions onSkip={handleSkip} pending={pending} />
      </form>
    </StepShell>
  )
}
