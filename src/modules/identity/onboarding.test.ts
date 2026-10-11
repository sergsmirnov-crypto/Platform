import { describe, expect, it } from 'vitest'

import {
  goalLabel,
  goalsStepSchema,
  isFinalStep,
  isOnboardingDone,
  levelStepSchema,
  nameStepSchema,
  ONBOARDING_GOALS,
  ONBOARDING_QUESTION_COUNT,
  ONBOARDING_STEPS,
  ONBOARDING_STEP_COUNT,
  questionNumber,
  resolveStepIndex,
  stepIndexFromParam,
  stepKeyAt,
  stepParamFromIndex,
  tasteStepSchema,
} from './onboarding'

describe('состав знакомства', () => {
  it('первый шаг — согласие, последний — первый разбор', () => {
    expect(stepKeyAt(0)).toBe('consent')
    expect(stepKeyAt(ONBOARDING_STEP_COUNT - 1)).toBe('first')
  })

  it('согласие пропустить нельзя, вопросы — можно', () => {
    const consent = ONBOARDING_STEPS.find((step) => step.key === 'consent')
    expect(consent?.skippable).toBe(false)

    const questions = ONBOARDING_STEPS.filter(
      (step) => step.key !== 'consent' && step.key !== 'first',
    )
    expect(questions.every((step) => step.skippable)).toBe(true)
  })

  it('вопросов ровно четыре: пять минут до первого видео большего не выдержат', () => {
    expect(ONBOARDING_QUESTION_COUNT).toBe(4)
  })
})

describe('шаг в адресной строке', () => {
  it('нумерация для человека начинается с единицы', () => {
    expect(stepIndexFromParam('1')).toBe(0)
    expect(stepIndexFromParam('3')).toBe(2)
    expect(stepParamFromIndex(0)).toBe('1')
  })

  it('отсутствие и мусор означают первый шаг', () => {
    expect(stepIndexFromParam(undefined)).toBe(0)
    expect(stepIndexFromParam('')).toBe(0)
    expect(stepIndexFromParam('второй')).toBe(0)
  })

  it('выход за границы прижимается к краям, а не ломает страницу', () => {
    expect(stepIndexFromParam('0')).toBe(0)
    expect(stepIndexFromParam('-5')).toBe(0)
    expect(stepIndexFromParam('999')).toBe(ONBOARDING_STEP_COUNT - 1)
  })
})

describe('resolveStepIndex', () => {
  it('назад пускает: ошибку в ответе надо давать исправить', () => {
    expect(resolveStepIndex(1, 4)).toBe(1)
  })

  it('вперёд дальше достигнутого не пускает', () => {
    expect(resolveStepIndex(5, 2)).toBe(2)
  })

  it('на достигнутый шаг пускает', () => {
    expect(resolveStepIndex(2, 2)).toBe(2)
  })

  it('новичок с подделанным адресом остаётся на согласии', () => {
    expect(resolveStepIndex(ONBOARDING_STEP_COUNT - 1, 0)).toBe(0)
  })

  it('сохранённый шаг за пределами списка не ломает вычисление', () => {
    expect(resolveStepIndex(3, 99)).toBe(3)
    expect(resolveStepIndex(3, -1)).toBe(0)
  })
})

describe('questionNumber', () => {
  it('на согласии и на итоге индикатора нет', () => {
    expect(questionNumber(0)).toBeNull()
    expect(questionNumber(ONBOARDING_STEP_COUNT - 1)).toBeNull()
  })

  it('вопросы нумеруются подряд с единицы', () => {
    expect(questionNumber(1)).toBe(1)
    expect(questionNumber(2)).toBe(2)
    expect(questionNumber(3)).toBe(3)
    expect(questionNumber(4)).toBe(4)
  })
})

describe('завершение', () => {
  it('знакомство пройдено, если есть отметка о завершении', () => {
    expect(isOnboardingDone(new Date())).toBe(true)
    expect(isOnboardingDone(null)).toBe(false)
  })

  it('последним считается экран первого разбора, а не последний вопрос', () => {
    expect(isFinalStep(ONBOARDING_STEP_COUNT - 1)).toBe(true)
    expect(isFinalStep(4)).toBe(false)
  })
})

describe('цели', () => {
  it('значения не повторяются', () => {
    const values = ONBOARDING_GOALS.map((goal) => goal.value)
    expect(new Set(values).size).toBe(values.length)
  })

  it('подпись находится по значению', () => {
    expect(goalLabel('campfire')).toBe('Играть песни в компании')
  })

  it('неизвестное значение возвращается как есть, а не пустотой', () => {
    expect(goalLabel('что-то старое')).toBe('что-то старое')
  })
})

describe('проверка шагов', () => {
  it('имя короче двух букв не принимается', () => {
    expect(nameStepSchema.safeParse({ displayName: 'И', city: '' }).success).toBe(false)
  })

  it('пустой город означает «не указан», а не пустую строку', () => {
    const result = nameStepSchema.parse({ displayName: 'Иван', city: '   ' })
    expect(result.city).toBeNull()
  })

  it('год в будущем не принимается', () => {
    const future = new Date().getFullYear() + 1
    expect(levelStepSchema.safeParse({ playingSince: future, skillLevel: null }).success).toBe(
      false,
    )
  })

  it('пустые ответы на вопросы допустимы: их можно пропустить', () => {
    expect(levelStepSchema.safeParse({ playingSince: null, skillLevel: null }).success).toBe(true)
    expect(tasteStepSchema.safeParse({ favoriteArtists: [], favoriteGenres: [] }).success).toBe(
      true,
    )
    expect(goalsStepSchema.safeParse({ goals: [] }).success).toBe(true)
  })

  it('выдуманный жанр не принимается: иначе подбор по жанрам перестанет находить', () => {
    const result = tasteStepSchema.safeParse({
      favoriteArtists: [],
      favoriteGenres: ['Вымышленный жанр'],
    })
    expect(result.success).toBe(false)
  })

  it('выдуманная цель не принимается', () => {
    expect(goalsStepSchema.safeParse({ goals: ['стать рок-звездой'] }).success).toBe(false)
  })
})
