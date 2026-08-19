'use client'

import { useState, useTransition } from 'react'

import { onboardingStrings } from '@/modules/identity/onboarding-strings'
import { SKILL_LEVELS } from '@/modules/identity/profile'
import { Field, Input } from '@/ui'

import { saveLevelAction, skipStepAction } from '../_actions/steps'

import { StepActions, StepShell } from './step-shell'

/**
 * Стаж и уровень.
 *
 * Самый важный вопрос знакомства: именно уровень определяет, какой разбор
 * человек увидит на последнем экране.
 *
 * Уровень выбирается одним из трёх, а не вычисляется из года начала
 * занятий. Соблазн вычислить велик — «играет с 2015, значит уверенный», —
 * но это неверно: люди берут гитару, бросают на пять лет и возвращаются,
 * и стаж в годах ничего не говорит о том, что человек умеет. Год нужен
 * для другого: он покажет куратору, что перед ним возвращенец, а не новичок.
 *
 * Подпись под выбором снимает главный страх этого вопроса — «а вдруг
 * я завышу и мне дадут непосильное». Уровень разбора меняется в один клик
 * на странице песни, и об этом надо сказать прямо здесь.
 */
export function LevelStep({
  stepIndex,
  initial,
  onDone,
}: {
  stepIndex: number
  initial: { playingSince: number | null; skillLevel: string | null }
  onDone: () => void
}) {
  const [playingSince, setPlayingSince] = useState(
    initial.playingSince === null ? '' : String(initial.playingSince),
  )
  const [skillLevel, setSkillLevel] = useState(initial.skillLevel ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  function handleSubmit() {
    setErrors({})

    startTransition(async () => {
      const result = await saveLevelAction({
        playingSince: playingSince === '' ? null : Number.parseInt(playingSince, 10),
        skillLevel: skillLevel === '' ? null : (skillLevel as 'beginner'),
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
      title={onboardingStrings.level.title}
      description={onboardingStrings.level.description}
      questionNumber={2}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          handleSubmit()
        }}
      >
        <Field
          label={onboardingStrings.level.sinceLabel}
          htmlFor="playingSince"
          error={errors.playingSince}
          hint={onboardingStrings.level.sinceHint}
        >
          <Input
            id="playingSince"
            // Числовая клавиатура на телефоне: год вводят с мобильного чаще,
            // чем с ноутбука
            inputMode="numeric"
            value={playingSince}
            onChange={(event) => setPlayingSince(event.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder={onboardingStrings.level.sincePlaceholder}
            disabled={pending}
          />
        </Field>

        <Field
          label={onboardingStrings.level.levelLabel}
          htmlFor="skillLevel"
          error={errors.skillLevel}
          hint={onboardingStrings.level.levelHint}
        >
          <div id="skillLevel" className="mt-1 flex flex-wrap gap-2">
            {SKILL_LEVELS.map((level) => (
              <button
                key={level.value}
                type="button"
                aria-pressed={skillLevel === level.value}
                disabled={pending}
                onClick={() => setSkillLevel(skillLevel === level.value ? '' : level.value)}
                className={
                  skillLevel === level.value
                    ? 'border-accent bg-accent text-accent-content min-h-11 rounded-full border px-4 text-sm'
                    : 'border-border text-content-muted hover:border-border-strong min-h-11 rounded-full border px-4 text-sm transition-colors'
                }
              >
                {level.label}
              </button>
            ))}
          </div>
        </Field>

        {errors.form ? <p className="text-danger text-sm">{errors.form}</p> : null}

        <StepActions onSkip={handleSkip} pending={pending} />
      </form>
    </StepShell>
  )
}
