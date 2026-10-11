import { redirect } from 'next/navigation'

import { getSession } from '@/modules/identity/current-user'
import {
  isFinalStep,
  resolveStepIndex,
  stepIndexFromParam,
  stepKeyAt,
} from '@/modules/identity/onboarding'
import { completeOnboarding, getOnboardingState } from '@/modules/identity/onboarding-service'
import { getStarterSong } from '@/modules/songs/service'
import { routes } from '@/shared/routes'

import { FirstStepScreen } from './_components/first-step-screen'
import { StepSwitcher } from './_components/step-switcher'

export const metadata = { title: 'Знакомство' }

/**
 * Знакомство с платформой.
 *
 * ─────────────────────────────────────────────────────────────────
 * ОДНА СТРАНИЦА НА ШЕСТЬ ЭКРАНОВ
 *
 * Мастер можно было собрать шестью маршрутами. Не стали: у шагов общие
 * данные и общее правило «не дальше достигнутого», и при шести страницах
 * это правило пришлось бы повторять шесть раз. Один пропущенный повтор —
 * и человек попадает на последний экран, не согласившись с офертой.
 *
 * Номер шага приходит из адресной строки. Это делает работающими кнопку
 * «Назад» и обновление страницы, но адрес — это пожелание, а не истина:
 * его правят руками. Поэтому запрошенный шаг всегда ограничивается
 * сохранённым (`resolveStepIndex`).
 * ─────────────────────────────────────────────────────────────────
 *
 * Знакомство отмечается пройденным при ОТКРЫТИИ последнего экрана,
 * а не при нажатии кнопки на нём. Человек, закрывший вкладку на «твоём
 * первом шаге», знакомство уже прошёл; показывать ему вопросы заново
 * было бы издевательством.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>
}) {
  const session = await getSession()
  if (!session) redirect(routes.home())

  const state = await getOnboardingState(session.user.id)
  if (!state) redirect(routes.home())

  const params = await searchParams
  const stepIndex = resolveStepIndex(stepIndexFromParam(params.step), state.onboardingStep)

  if (isFinalStep(stepIndex)) {
    await completeOnboarding(session.user.id)
    // Подбор — вопрос к модулю разборов, и задаёт его страница:
    // `identity` не знает ни о жанрах, ни об уровнях разборов
    const pick = await getStarterSong({
      level: state.skillLevel,
      genres: state.favoriteGenres,
    })

    return <FirstStepScreen pick={pick} />
  }

  return (
    <StepSwitcher
      stepKey={stepKeyAt(stepIndex)}
      stepIndex={stepIndex}
      state={{
        displayName: state.displayName,
        city: state.city,
        playingSince: state.playingSince,
        skillLevel: state.skillLevel,
        favoriteArtists: state.favoriteArtists,
        favoriteGenres: state.favoriteGenres,
        goals: state.goals,
      }}
      // Участник, вошедший до появления знакомства: у него есть прогресс,
      // но нет согласия. Ему нужно объяснение, почему платформа вдруг
      // спрашивает то, чего раньше не спрашивала
      isReturningMember={
        state.onboardingDoneAt === null && state.onboardingStep === 0 && hasHistory(state)
      }
    />
  )
}

/**
 * Признак того, что человек в клубе не первый день.
 *
 * Заполненный профиль означает, что он пользовался платформой до того,
 * как знакомство появилось. Точного признака у нас нет и не нужно:
 * ошибка в любую сторону стоит одной лишней или недостающей строки
 * объяснения.
 */
function hasHistory(state: { city: string | null; favoriteGenres: string[] }): boolean {
  return state.city !== null || state.favoriteGenres.length > 0
}
