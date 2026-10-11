'use server'

import { z } from 'zod'

import { getRequestOrigin } from '@/modules/identity/cookie'
import { getSession } from '@/modules/identity/current-user'
import {
  goalsStepSchema,
  levelStepSchema,
  nameStepSchema,
  ONBOARDING_STEP_COUNT,
  tasteStepSchema,
} from '@/modules/identity/onboarding'
import {
  saveGoals,
  saveLevel,
  saveName,
  saveTaste,
  skipStep,
} from '@/modules/identity/onboarding-service'
import { normalizeArtists } from '@/modules/identity/profile'
import { hashClientIp } from '@/modules/identity/service'
import { acceptCurrentDocuments } from '@/modules/legal/service'
import { errors } from '@/shared/errors'
import { defineAction } from '@/shared/server'

/**
 * Действия шагов знакомства.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЧЕГО ЗДЕСЬ НЕТ И ПОЧЕМУ
 *
 * Идентификатора человека во входных данных нет ни у одного действия:
 * он берётся из сессии. Заполнить профиль другому человеку невозможно
 * не потому, что мы это проверяем, а потому, что прислать чужой
 * идентификатор некуда.
 *
 * Проверки прав тоже нет: своё знакомство проходит каждый, и особого
 * права для этого не требуется. Единственное, что проверяется, — что
 * человек вошёл.
 *
 * Номер достигнутого шага, наоборот, приходит с формы. Подделать его можно,
 * и это ничего не даёт: страница всё равно ограничивает шаг сохранённым
 * значением (`resolveStepIndex`), а перескочить через согласие нельзя —
 * записи о нём не появится, и проверка в разметке закрытой зоны вернёт
 * человека назад.
 * ─────────────────────────────────────────────────────────────────
 *
 * Страницы отсюда не обновляются принудительно: после каждого действия
 * форма сама переводит человека на следующий шаг, и лишняя перерисовка
 * только мигнула бы экраном.
 */

/** Номер шага, до которого человек добрался. Ограничен размером мастера */
const reachedStep = z
  .number()
  .int()
  .min(0)
  .max(ONBOARDING_STEP_COUNT - 1)

async function currentUserId(): Promise<string> {
  const session = await getSession()
  if (!session) throw errors.unauthorized()

  return session.user.id
}

/**
 * Согласие с офертой и политикой.
 *
 * Флажок проверяется схемой как обязательно истинный: снятый флажок —
 * это не «согласие со значением ложь», а отсутствие согласия, и записывать
 * его нельзя.
 *
 * Обстоятельства согласия — хеш адреса и браузер — берутся из запроса
 * здесь, а не в сервисе: сервис работает и в фоновых задачах, где запроса
 * нет вовсе.
 */
export const acceptDocumentsAction = defineAction({
  name: 'onboarding.accept',
  input: z.object({
    accepted: z.literal(true, { message: 'Без согласия пользоваться платформой нельзя' }),
    reachedStep,
  }),
  handler: async ({ reachedStep: step }) => {
    const userId = await currentUserId()
    const origin = await getRequestOrigin()

    // Два модуля подряд, а не один вызов «сделай всё»: согласие
    // принадлежит `legal`, номер шага — `identity`, и складывать их
    // в поведение — работа этого слоя. Порядок важен: сначала согласие,
    // потом сдвиг шага. При сбое записи согласия человек увидит тот же
    // экран снова — это верно. Обратный порядок пропустил бы его дальше
    // без записи, то есть без основания обрабатывать его данные
    await acceptCurrentDocuments(userId, {
      ipHash: hashClientIp(origin.ip),
      userAgent: origin.userAgent ? origin.userAgent.slice(0, 400) : null,
    })

    await skipStep(userId, step)

    return { ok: true }
  },
})

export const saveNameAction = defineAction({
  name: 'onboarding.name',
  input: nameStepSchema.extend({ reachedStep }),
  handler: async ({ reachedStep: step, ...input }) => {
    await saveName(await currentUserId(), step, input)
    return { ok: true }
  },
})

export const saveLevelAction = defineAction({
  name: 'onboarding.level',
  input: levelStepSchema.extend({ reachedStep }),
  handler: async ({ reachedStep: step, ...input }) => {
    await saveLevel(await currentUserId(), step, input)
    return { ok: true }
  },
})

/**
 * Вкусы.
 *
 * Исполнители проходят через `normalizeArtists` — ту же функцию, что
 * и в профиле: она убирает повторы и пустые значения. Два разных способа
 * приведения означали бы, что «Metallica» из знакомства и «metallica»
 * из профиля станут разными исполнителями.
 */
export const saveTasteAction = defineAction({
  name: 'onboarding.taste',
  input: tasteStepSchema.extend({ reachedStep }),
  handler: async ({ reachedStep: step, favoriteArtists, favoriteGenres }) => {
    await saveTaste(await currentUserId(), step, {
      favoriteArtists: normalizeArtists(favoriteArtists),
      favoriteGenres,
    })

    return { ok: true }
  },
})

export const saveGoalsAction = defineAction({
  name: 'onboarding.goals',
  input: goalsStepSchema.extend({ reachedStep }),
  handler: async ({ reachedStep: step, goals }) => {
    await saveGoals(await currentUserId(), step, { goals })
    return { ok: true }
  },
})

/**
 * Пропуск вопроса.
 *
 * Отдельное действие, а не сохранение пустых значений: пропуск не должен
 * стирать уже введённое. Человек, вернувшийся назад и нажавший «Пропустить»,
 * не обязан потерять ответ, который дал раньше.
 */
export const skipStepAction = defineAction({
  name: 'onboarding.skip',
  input: z.object({ reachedStep }),
  handler: async ({ reachedStep: step }) => {
    await skipStep(await currentUserId(), step)
    return { ok: true }
  },
})
