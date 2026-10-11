'use client'

import { useRouter } from 'next/navigation'

import { stepParamFromIndex } from '@/modules/identity/onboarding'
import type { OnboardingStepKey } from '@/modules/identity/onboarding'
import { routes } from '@/shared/routes'

import { ConsentStep } from './consent-step'
import { GoalsStep } from './goals-step'
import { LevelStep } from './level-step'
import { NameStep } from './name-step'
import { TasteStep } from './taste-step'

/**
 * Переключение между шагами.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗАЧЕМ НУЖНА ЭТА ПРОСЛОЙКА
 *
 * Шаг живёт в адресной строке, а адресную строку меняет только браузерный
 * код. Страница при этом серверная: она читает ответы из базы и решает,
 * какой шаг показать. Прослойка соединяет одно с другим — она получает
 * готовые данные с сервера и умеет единственное действие: перейти
 * на следующий шаг.
 *
 * Собственного состояния у неё нет намеренно. Ответы хранятся в базе,
 * шаг — в адресе; третье место, где что-то помнится, рано или поздно
 * разошлось бы с первыми двумя.
 * ─────────────────────────────────────────────────────────────────
 *
 * `router.replace`, а не `push`: иначе кнопка «Назад» проводила бы человека
 * по всем пройденным шагам в обратном порядке, вместо того чтобы выйти
 * из знакомства. Возврат к предыдущему вопросу делается не браузером,
 * а адресом — он всегда доступен.
 */
export function StepSwitcher({
  stepKey,
  stepIndex,
  state,
  isReturningMember,
}: {
  stepKey: OnboardingStepKey
  stepIndex: number
  state: {
    displayName: string
    city: string | null
    playingSince: number | null
    skillLevel: string | null
    favoriteArtists: string[]
    favoriteGenres: string[]
    goals: string[]
  }
  isReturningMember: boolean
}) {
  const router = useRouter()

  function goNext() {
    const next = stepParamFromIndex(stepIndex + 1)
    router.replace(`${routes.app.onboarding()}?step=${next}`)
  }

  if (stepKey === 'consent') {
    return (
      <ConsentStep stepIndex={stepIndex} isReturningMember={isReturningMember} onDone={goNext} />
    )
  }

  if (stepKey === 'name') {
    return (
      <NameStep
        stepIndex={stepIndex}
        initial={{ displayName: state.displayName, city: state.city }}
        onDone={goNext}
      />
    )
  }

  if (stepKey === 'level') {
    return (
      <LevelStep
        stepIndex={stepIndex}
        initial={{ playingSince: state.playingSince, skillLevel: state.skillLevel }}
        onDone={goNext}
      />
    )
  }

  if (stepKey === 'taste') {
    return (
      <TasteStep
        stepIndex={stepIndex}
        initial={{
          favoriteArtists: state.favoriteArtists,
          favoriteGenres: state.favoriteGenres,
        }}
        onDone={goNext}
      />
    )
  }

  return <GoalsStep stepIndex={stepIndex} initial={{ goals: state.goals }} onDone={goNext} />
}
