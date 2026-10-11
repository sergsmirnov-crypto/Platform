import { compareLevels, LEVEL_VALUES } from './domain'

import type { Level } from './domain'

/**
 * Какой вариант разбора показать человеку, открывшему страницу песни.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ЭТО ОТДЕЛЬНЫЙ ФАЙЛ, А НЕ ДЕСЯТЬ СТРОК В КОМПОНЕНТЕ
 *
 * Вопрос выглядит простым ровно до перечисления случаев:
 *
 *   у песни три уровня, человек ничего не выбрал
 *   у песни два разбора одного уровня от разных кураторов
 *   в ссылке указан уровень, которого у этой песни нет
 *   в ссылке указан вариант, который с тех пор сняли с публикации
 *   у песни нет ни одного варианта вовсе
 *
 * Каждый из них — живой, и ошибка в любом означает пустой экран
 * вместо разбора. Поэтому выбор вынесен в чистые функции: ни базы,
 * ни React, ни адресов — и покрыт тестами целиком.
 * ─────────────────────────────────────────────────────────────────
 */

/** Минимум, который нужен для выбора. Больше знать не требуется */
export type SelectableArrangement = {
  id: string
  level: Level
  title: string | null
}

/** Один уровень и все варианты разбора, которые к нему относятся */
export type LevelGroup<T extends SelectableArrangement> = {
  level: Level
  arrangements: T[]
}

/**
 * Раскладывает варианты по уровням, от простого к сложному.
 *
 * Уровни, которых у песни нет, в результат не попадают: показывать
 * пустую вкладку «Продвинутый» означает обещать разбор, которого
 * не существует.
 */
export function groupByLevel<T extends SelectableArrangement>(
  arrangements: readonly T[],
): LevelGroup<T>[] {
  const groups = new Map<Level, T[]>()

  for (const arrangement of arrangements) {
    const existing = groups.get(arrangement.level)
    if (existing) existing.push(arrangement)
    else groups.set(arrangement.level, [arrangement])
  }

  return [...groups.entries()]
    .map(([level, items]) => ({ level, arrangements: items }))
    .sort((a, b) => compareLevels(a.level, b.level))
}

/**
 * Ближайший подходящий уровень.
 *
 * Нужен, когда у человека в профиле «Продвинутый», а у песни разобран
 * только «Начинающий». Отдать в этом случае пустоту нельзя, и брать
 * первый попавшийся — тоже: разница между «проще, чем ты умеешь»
 * и «сложнее, чем ты умеешь» для гитариста принципиальная.
 *
 * Правило: сначала ищем уровень попроще желаемого, и только если
 * такого нет — берём самый простой из тех, что сложнее. Разобрать
 * песню ниже своего уровня скучно, но возможно; выше — невозможно,
 * и человек уходит со страницы.
 */
export function nearestLevel(available: readonly Level[], preferred: Level): Level | null {
  if (available.length === 0) return null
  if (available.includes(preferred)) return preferred

  const wanted = LEVEL_VALUES.indexOf(preferred)
  const sorted = [...available].sort(compareLevels)

  const simpler = sorted.filter((level) => LEVEL_VALUES.indexOf(level) < wanted)
  if (simpler.length > 0) return simpler[simpler.length - 1] as Level

  return sorted[0] as Level
}

export type SelectionRequest = {
  /** Что попросили в адресе: `?level=intermediate`. `null` — не просили */
  requestedLevel: Level | null
  /** Что попросили в адресе: `?v=<id>`. `null` — не просили */
  requestedId: string | null
  /** Уровень игры из профиля участника. `null` — не заполнен */
  profileLevel: Level | null
}

export type Selection<T extends SelectableArrangement> = {
  /** Выбранный вариант. `null` — у песни нет ни одного */
  arrangement: T | null
  /** Уровни песни в порядке от простого к сложному — для переключателя */
  groups: LevelGroup<T>[]
  /** Варианты выбранного уровня. Больше одного — показывается второй ряд */
  siblings: T[]
}

/**
 * Выбор варианта. Единственная точка принятия этого решения.
 *
 * Порядок предпочтений — от самого явного намерения к самому слабому:
 *
 *   1. вариант прямо указан в ссылке — открываем его
 *   2. уровень указан в ссылке — берём первый вариант этого уровня
 *   3. уровень есть в профиле — берём ближайший подходящий
 *   4. ничего не известно — берём самый простой из имеющихся
 *
 * Несуществующее значение в ссылке не считается ошибкой и просто
 * не учитывается: ссылки правят руками, пересылают и режут при
 * копировании. Страница ошибки вместо разбора здесь была бы
 * несоразмерной реакцией на лишний символ в адресе.
 */
export function selectArrangement<T extends SelectableArrangement>(
  arrangements: readonly T[],
  request: SelectionRequest,
): Selection<T> {
  const groups = groupByLevel(arrangements)

  if (groups.length === 0) {
    return { arrangement: null, groups: [], siblings: [] }
  }

  const byId = request.requestedId
    ? arrangements.find((item) => item.id === request.requestedId)
    : undefined

  const level = byId
    ? byId.level
    : resolveLevel(
        groups.map((group) => group.level),
        request,
      )

  const siblings = groups.find((group) => group.level === level)?.arrangements ?? []

  return {
    arrangement: byId ?? siblings[0] ?? null,
    groups,
    siblings,
  }
}

function resolveLevel(available: readonly Level[], request: SelectionRequest): Level {
  const requested = request.requestedLevel && nearestLevelIfExact(available, request.requestedLevel)
  if (requested) return requested

  const fromProfile = request.profileLevel && nearestLevel(available, request.profileLevel)
  if (fromProfile) return fromProfile

  // Самый простой из имеющихся: человек без заполненного профиля
  // скорее новичок, чем нет, и начать с простого безопаснее
  return available[0] as Level
}

/**
 * Уровень из ссылки применяется только точным совпадением.
 *
 * Подменять его «ближайшим» нельзя: человек перешёл по ссылке
 * «продвинутый разбор» и должен увидеть либо его, либо честный
 * выбор по своему профилю, а не молча подсунутый уровень для
 * начинающих, который он примет за продвинутый.
 */
function nearestLevelIfExact(available: readonly Level[], requested: Level): Level | null {
  return available.includes(requested) ? requested : null
}

/**
 * Нужен ли второй ряд переключателя.
 *
 * Второй ряд появляется только тогда, когда на выбранном уровне
 * действительно несколько разборов. Постоянно висящий ряд из одного
 * элемента — это вопрос «а что ещё я должен здесь выбрать?»,
 * заданный каждому участнику на каждой странице.
 */
export function hasVariantChoice<T extends SelectableArrangement>(siblings: readonly T[]): boolean {
  return siblings.length > 1
}

/**
 * Как назвать вариант в переключателе.
 *
 * Куратор заполняет название не всегда, а различать варианты человеку
 * нужно всегда. Поэтому есть запасной вариант — имя куратора,
 * и только если и его нет, порядковый номер.
 */
export function variantLabel(
  arrangement: { title: string | null; curator: { displayName: string } | null },
  index: number,
): string {
  if (arrangement.title) return arrangement.title
  if (arrangement.curator) return arrangement.curator.displayName

  return `Вариант ${index + 1}`
}
