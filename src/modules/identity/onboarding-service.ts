import 'server-only'

import { getLogger } from '@/shared/logger'

import {
  finishOnboarding,
  findOnboardingState,
  saveOnboardingGoals,
  saveOnboardingLevel,
  saveOnboardingName,
  saveOnboardingTaste,
  skipOnboardingStep,
} from './repository'

import type { GoalsStepInput, LevelStepInput, NameStepInput } from './onboarding'
import type { OnboardingState } from './repository'

/**
 * Знакомство с платформой: работа с данными участника.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ЗДЕСЬ, А НЕ В ОТДЕЛЬНОМ МОДУЛЕ `onboarding`
 *
 * У знакомства нет своих таблиц: оно записывает поля в `users`. Модуль,
 * который ничем не владеет и импортирует схему соседа, — это папка ради
 * симметрии; через год никто не ответит, где искать логику заполнения
 * профиля, потому что она окажется в двух местах.
 *
 * Знакомство — это способ впервые заполнить профиль. Профиль живёт
 * в `identity`, значит и знакомство живёт здесь.
 * ─────────────────────────────────────────────────────────────────
 *
 * ⚠️ ЗДЕСЬ ТОЛЬКО СВОИ ДАННЫЕ. Согласие с документами и подбор первого
 * разбора живут в соседних модулях, и вызывает их слой приложения,
 * а не этот файл. Первая попытка была иной — сервис звал `legal`
 * и `songs` сам, — и линтер справедливо это отверг: модуль, тянущий
 * два чужих, перестаёт быть отделимым, а знакомство при этом остаётся
 * сценарием, а не предметной областью. Складывать ответы трёх модулей
 * в поведение — работа страницы (см. `app/app/_lib/guards.ts`).
 */

export type { OnboardingState }

export async function getOnboardingState(userId: string): Promise<OnboardingState | null> {
  return findOnboardingState(userId)
}

export async function saveName(
  userId: string,
  reachedStep: number,
  input: NameStepInput,
): Promise<void> {
  await saveOnboardingName(userId, reachedStep, input)
}

export async function saveLevel(
  userId: string,
  reachedStep: number,
  input: LevelStepInput,
): Promise<void> {
  await saveOnboardingLevel(userId, reachedStep, input)
}

export async function saveTaste(
  userId: string,
  reachedStep: number,
  input: { favoriteArtists: string[]; favoriteGenres: readonly string[] },
): Promise<void> {
  await saveOnboardingTaste(userId, reachedStep, {
    favoriteArtists: input.favoriteArtists,
    favoriteGenres: [...input.favoriteGenres],
  })
}

export async function saveGoals(
  userId: string,
  reachedStep: number,
  input: GoalsStepInput,
): Promise<void> {
  await saveOnboardingGoals(userId, reachedStep, { goals: [...input.goals] })
}

/**
 * Пропуск вопроса: ответы не меняются, шаг сдвигается.
 *
 * Этим же вызовом продвигается шаг после согласия с документами —
 * записывает согласие слой приложения, а сдвинуть шаг может только тот,
 * кто владеет полем.
 */
export async function skipStep(userId: string, reachedStep: number): Promise<void> {
  await skipOnboardingStep(userId, reachedStep)
}

/**
 * Завершение знакомства.
 *
 * Вызывается при открытии последнего экрана, а не при нажатии кнопки
 * на нём: человек, закрывший вкладку на «твоём первом шаге», знакомство
 * уже прошёл, и показывать ему вопросы заново было бы издевательством.
 */
export async function completeOnboarding(userId: string): Promise<void> {
  await finishOnboarding(userId)
  getLogger().info({ userId }, 'знакомство с платформой пройдено')
}
