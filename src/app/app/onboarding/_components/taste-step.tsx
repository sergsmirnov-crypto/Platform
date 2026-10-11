'use client'

import { useState, useTransition } from 'react'

import { onboardingStrings } from '@/modules/identity/onboarding-strings'
import { GENRES, MAX_FAVORITE_ARTISTS } from '@/modules/identity/profile'
import { ChipsInput, Field, ToggleGroup } from '@/ui'

import { saveTasteAction, skipStepAction } from '../_actions/steps'

import { StepActions, StepShell } from './step-shell'

/**
 * Любимые исполнители и жанры.
 *
 * Жанры — второе, по чему подбирается первый разбор. Исполнители сейчас
 * ни на что не влияют: у нас нет разметки разборов по исполнителям, кроме
 * поля самой песни. Спрашиваем их всё равно — по двум причинам. Куратор,
 * открывая карточку участника, видит, что человек слушает, и это прямо
 * влияет на то, какие песни попадут в план разборов. И глобальный поиск
 * на шаге 10.4 сможет предложить «у нас есть три разбора Metallica».
 *
 * Жанры выбираются из списка, а не вводятся текстом. Свободный ввод дал бы
 * «рок», «Рок» и «rock» тремя жанрами, и подбор перестал бы находить
 * что-либо в тот же день.
 */
export function TasteStep({
  stepIndex,
  initial,
  onDone,
}: {
  stepIndex: number
  initial: { favoriteArtists: string[]; favoriteGenres: string[] }
  onDone: () => void
}) {
  const [artists, setArtists] = useState<string[]>(initial.favoriteArtists)
  const [genres, setGenres] = useState<string[]>(initial.favoriteGenres)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  function handleSubmit() {
    setErrors({})

    startTransition(async () => {
      const result = await saveTasteAction({
        favoriteArtists: artists,
        favoriteGenres: genres as [],
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
      title={onboardingStrings.taste.title}
      description={onboardingStrings.taste.description}
      questionNumber={3}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          handleSubmit()
        }}
      >
        <Field
          label={onboardingStrings.taste.genresLabel}
          htmlFor="genres"
          error={errors.favoriteGenres}
          hint={onboardingStrings.taste.genresHint}
        >
          <div id="genres" className="mt-1">
            <ToggleGroup options={GENRES} values={genres} onChange={setGenres} disabled={pending} />
          </div>
        </Field>

        <Field
          label={onboardingStrings.taste.artistsLabel}
          htmlFor="artists"
          error={errors.favoriteArtists}
        >
          <ChipsInput
            id="artists"
            values={artists}
            onChange={setArtists}
            placeholder={onboardingStrings.taste.artistsPlaceholder}
            max={MAX_FAVORITE_ARTISTS}
            disabled={pending}
          />
        </Field>

        {errors.form ? <p className="text-danger text-sm">{errors.form}</p> : null}

        <StepActions onSkip={handleSkip} pending={pending} />
      </form>
    </StepShell>
  )
}
