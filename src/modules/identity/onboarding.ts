import { z } from 'zod'

import { GENRES, MAX_FAVORITE_ARTISTS } from './profile'

/**
 * Правила знакомства с платформой.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗАЧЕМ ЗНАКОМСТВО ВООБЩЕ НУЖНО
 *
 * Не ради данных в профиле. Ради первого разбора.
 *
 * Главная метрика продукта — время от регистрации до первого видео
 * меньше пяти минут (PRD v0.1 §14). Без знакомства новый участник
 * попадает на главную, где карточка «Продолжить» пуста, прогресс нулевой,
 * и ему предлагается самому разобраться, с чего начать. Четыре вопроса
 * существуют затем, чтобы на последнем экране можно было показать
 * не каталог из двухсот позиций, а одну кнопку с конкретной песней.
 *
 * Отсюда следует всё остальное: вопросов ровно столько, сколько нужно
 * для подбора, каждый можно пропустить, и ни один не требует искать файл
 * или вспоминать пароль.
 * ─────────────────────────────────────────────────────────────────
 *
 * Здесь только чистые правила: ни базы, ни запроса. Поэтому они целиком
 * покрыты тестами и работают одинаково на сервере и в форме.
 */

/**
 * Шаги знакомства по порядку.
 *
 * `consent` не пропускается: это правовое условие пользования платформой,
 * а не сведение о человеке. Остальные пропускаются — взрослый человек
 * вправе не рассказывать о себе, и запирать его за формой из четырёх
 * вопросов было бы худшим первым впечатлением, чем неподобранный разбор.
 */
export const ONBOARDING_STEPS = [
  { key: 'consent', skippable: false },
  { key: 'name', skippable: true },
  { key: 'level', skippable: true },
  { key: 'taste', skippable: true },
  { key: 'goals', skippable: true },
  { key: 'first', skippable: false },
] as const

export type OnboardingStepKey = (typeof ONBOARDING_STEPS)[number]['key']

/** Сколько шагов всего. Последний — не вопрос, а итог */
export const ONBOARDING_STEP_COUNT = ONBOARDING_STEPS.length

/**
 * Сколько шагов показывается в индикаторе прогресса.
 *
 * Итоговый экран в счёт не идёт: «шаг 6 из 6» на экране, где уже нечего
 * делать, выглядит как ещё одна задача. Согласие тоже не идёт — оно
 * не вопрос о человеке и появляется до того, как знакомство началось.
 */
export const ONBOARDING_QUESTION_COUNT = ONBOARDING_STEPS.filter(
  (step) => step.key !== 'consent' && step.key !== 'first',
).length

/**
 * Номер шага в адресной строке — от единицы, как его видит человек.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ШАГ В АДРЕСНОЙ СТРОКЕ, А НЕ В СОСТОЯНИИ БРАУЗЕРА
 *
 * Мастер из шести экранов проще всего собрать на `useState`. Но тогда:
 * кнопка «Назад» выходит из мастера целиком, закрытая вкладка теряет
 * ответы, а обновление страницы возвращает к началу.
 *
 * Шаг в адресе решает всё это бесплатно и совпадает с тем, как в проекте
 * уже устроены фильтры каталога. Ответы при этом сохраняются в базу
 * на каждом шаге — «прогресс сохраняется» из PRD §4.1 означает именно это,
 * а не запоминание в памяти вкладки.
 * ─────────────────────────────────────────────────────────────────
 */
export function stepIndexFromParam(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isInteger(parsed)) return 0

  return clampStepIndex(parsed - 1)
}

export function stepParamFromIndex(index: number): string {
  return String(clampStepIndex(index) + 1)
}

function clampStepIndex(index: number): number {
  if (index < 0) return 0
  if (index > ONBOARDING_STEP_COUNT - 1) return ONBOARDING_STEP_COUNT - 1
  return index
}

/**
 * На каком шаге человек находится в действительности.
 *
 * Адрес — это пожелание, а не истина: его можно поправить руками
 * и попасть на последний экран, не согласившись с офертой. Поэтому
 * запрошенный шаг ограничивается сохранённым: назад — куда угодно,
 * вперёд — не дальше следующего.
 *
 * Возможность вернуться назад важнее строгости: человек, ошибшийся
 * в уровне, должен иметь возможность это исправить, не проходя знакомство
 * заново.
 */
export function resolveStepIndex(requested: number, savedStep: number): number {
  const reached = clampStepIndex(savedStep)
  const wanted = clampStepIndex(requested)

  return Math.min(wanted, reached)
}

export function stepAt(index: number): (typeof ONBOARDING_STEPS)[number] {
  // Границы уже ограничены, обращение всегда попадает в список
  return ONBOARDING_STEPS[clampStepIndex(index)] as (typeof ONBOARDING_STEPS)[number]
}

export function stepKeyAt(index: number): OnboardingStepKey {
  return stepAt(index).key
}

/** Номер вопроса для индикатора: `null` там, где индикатор не нужен */
export function questionNumber(index: number): number | null {
  const key = stepKeyAt(index)
  if (key === 'consent' || key === 'first') return null

  return (
    ONBOARDING_STEPS.slice(0, clampStepIndex(index)).filter(
      (step) => step.key !== 'consent' && step.key !== 'first',
    ).length + 1
  )
}

/** Пройдено ли знакомство */
export function isOnboardingDone(onboardingDoneAt: Date | null): boolean {
  return onboardingDoneAt !== null
}

/**
 * Достигнут ли последний экран.
 *
 * Знакомство считается завершённым именно здесь, а не после четвёртого
 * вопроса: пока человек не увидел «твой первый шаг», главная задача
 * знакомства не выполнена.
 */
export function isFinalStep(index: number): boolean {
  return stepKeyAt(index) === 'first'
}

/**
 * Цели занятий.
 *
 * Список закрытый, как и жанры, и по той же причине: свободный ввод дал бы
 * «хочу играть у костра», «костёр», «песни у костра» тремя разными целями,
 * и подбор материалов по цели не заработал бы никогда. Формулировки — от
 * первого лица: человек выбирает про себя, а не отвечает на анкету.
 */
export const ONBOARDING_GOALS = [
  { value: 'campfire', label: 'Играть песни в компании' },
  { value: 'favorites', label: 'Разобрать любимые песни' },
  { value: 'technique', label: 'Подтянуть технику' },
  { value: 'theory', label: 'Разобраться в теории' },
  { value: 'own_music', label: 'Писать свою музыку' },
  { value: 'band', label: 'Играть в группе' },
  { value: 'restart', label: 'Вернуться к инструменту после перерыва' },
] as const

export const GOAL_VALUES = ONBOARDING_GOALS.map((goal) => goal.value) as [string, ...string[]]

export type OnboardingGoal = (typeof ONBOARDING_GOALS)[number]['value']

export function goalLabel(value: string): string {
  return ONBOARDING_GOALS.find((goal) => goal.value === value)?.label ?? value
}

/**
 * Схемы шагов.
 *
 * Каждый шаг проверяется отдельно, а не общей схемой профиля. Причина
 * практическая: общая схема требует имя длиной хотя бы в две буквы, и шаг
 * с жанрами не сохранился бы у человека, чьё имя в Telegram — одна буква.
 * Шаг обязан отвечать за свои поля и только за них.
 */

const EARLIEST_PLAYING_YEAR = 1930

export const nameStepSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Имя должно быть хотя бы из двух букв')
    .max(60, 'Имя длиннее 60 символов не поместится в карточку'),
  city: z
    .string()
    .trim()
    .max(60, 'Название города длиннее 60 символов')
    .transform((value) => (value.length === 0 ? null : value))
    .nullable(),
})

export const levelStepSchema = z.object({
  playingSince: z
    .number()
    .int()
    .min(EARLIEST_PLAYING_YEAR, 'Такой год выглядит опечаткой')
    .max(new Date().getFullYear(), 'Год начала игры не может быть в будущем')
    .nullable(),
  skillLevel: z.enum(['beginner', 'intermediate', 'advanced']).nullable(),
})

export const tasteStepSchema = z.object({
  favoriteArtists: z
    .array(z.string().trim().min(1).max(60))
    .max(MAX_FAVORITE_ARTISTS, `Не больше ${MAX_FAVORITE_ARTISTS} исполнителей`),
  favoriteGenres: z.array(z.enum(GENRES)),
})

export const goalsStepSchema = z.object({
  goals: z.array(z.enum(GOAL_VALUES)),
})

export type NameStepInput = z.infer<typeof nameStepSchema>
export type LevelStepInput = z.infer<typeof levelStepSchema>
export type TasteStepInput = z.infer<typeof tasteStepSchema>
export type GoalsStepInput = z.infer<typeof goalsStepSchema>
