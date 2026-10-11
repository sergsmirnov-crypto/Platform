import type { PublicationStatus } from '@/shared/db/enums'
import { slugify } from '@/shared/utils/slug'

/**
 * Правила разборов: уровни, строи, части, длительности, адреса.
 *
 * Ни базы, ни запросов — только знание о предметной области. Поэтому файл
 * покрыт тестами целиком и одинаково доступен серверу и браузеру: каталог
 * в браузере разбирает фильтры теми же функциями, какими сервер соберёт
 * по ним запрос.
 */

// ─── Уровни ───

/**
 * Уровень сложности.
 *
 * Та же шкала, что уровень игры в профиле участника, и это сделано
 * нарочно: при первом входе платформа должна показать человеку разбор
 * ему по силам, а не заставлять его сопоставлять две разные шкалы.
 */
export const LEVELS = [
  { value: 'beginner', label: 'Начинающий', short: 'Нач.' },
  { value: 'intermediate', label: 'Уверенный', short: 'Уверен.' },
  { value: 'advanced', label: 'Продвинутый', short: 'Продв.' },
] as const

export type Level = (typeof LEVELS)[number]['value']

export const LEVEL_VALUES = LEVELS.map((level) => level.value) as Level[]

export function isLevel(value: unknown): value is Level {
  return typeof value === 'string' && LEVEL_VALUES.includes(value as Level)
}

export function levelLabel(level: Level): string {
  return LEVELS.find((item) => item.value === level)?.label ?? level
}

/** От простого к сложному. Нужен для сортировки вариантов на странице песни */
export function compareLevels(a: Level, b: Level): number {
  return LEVEL_VALUES.indexOf(a) - LEVEL_VALUES.indexOf(b)
}

// ─── Строй гитары ───

/**
 * Строи.
 *
 * Список закрытый, в отличие от жанров: строёв конечное число, и свободный
 * ввод дал бы «Drop D», «drop d» и «дроп ре» как три разных значения —
 * а фильтр по строю нужен именно точный. Человек ищет то, подо что
 * гитара уже настроена.
 */
export const TUNINGS = [
  { value: 'e_standard', label: 'E standard', notes: 'E A D G B E' },
  { value: 'eb_standard', label: 'Eb standard', notes: 'Eb Ab Db Gb Bb Eb' },
  { value: 'drop_d', label: 'Drop D', notes: 'D A D G B E' },
  { value: 'drop_c', label: 'Drop C', notes: 'C G C F A D' },
  { value: 'dadgad', label: 'DADGAD', notes: 'D A D G A D' },
  { value: 'open_g', label: 'Open G', notes: 'D G D G B D' },
  { value: 'open_d', label: 'Open D', notes: 'D A D F# A D' },
] as const

export type Tuning = (typeof TUNINGS)[number]['value']

export const TUNING_VALUES = TUNINGS.map((tuning) => tuning.value) as Tuning[]

export function isTuning(value: unknown): value is Tuning {
  return typeof value === 'string' && TUNING_VALUES.includes(value as Tuning)
}

export function tuningLabel(tuning: string | null): string | null {
  if (!tuning) return null

  return TUNINGS.find((item) => item.value === tuning)?.label ?? tuning
}

// ─── Адрес страницы ───

/**
 * Адрес разбора собирается из исполнителя и названия.
 *
 * Именно в таком порядке: адреса группируются по исполнителю, и в списке
 * ссылок это сразу видно. Обратный порядок дал бы `peremen-kino`
 * и `pachka-sigaret-kino` в разных концах алфавита.
 */
export function songSlug(artist: string, title: string): string {
  return slugify(`${artist} ${title}`)
}

/**
 * Делает адрес неповторяющимся.
 *
 * Две песни с одинаковым названием у одного исполнителя — редкость,
 * но живая: концертная версия рядом со студийной. Числовой хвост
 * понятнее, чем отказ сохранить разбор с сообщением «адрес занят».
 */
export function uniqueSlug(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base

  let counter = 2
  while (taken.includes(`${base}-${counter}`)) counter += 1

  return `${base}-${counter}`
}

// ─── Части разбора ───

/**
 * Заготовки структуры.
 *
 * Куратор выбирает шаблон — части создаются сами, остаётся загрузить видео.
 * Ради этого шаблоны и существуют: цель — десять минут на публикацию
 * разбора (PRD v0.1 §4.7), а набивание одних и тех же шести названий
 * руками съедает половину этого времени.
 */
export const SECTION_TEMPLATES = [
  {
    value: 'standard',
    label: 'Обычная песня',
    hint: 'Вступление, куплет, припев, проигрыш, соло, сборка',
    sections: ['Вступление', 'Куплет', 'Припев', 'Проигрыш', 'Соло', 'Сборка целиком'],
  },
  {
    value: 'simple',
    label: 'Простая песня',
    hint: 'Три части: вступление, основа, сборка',
    sections: ['Вступление', 'Основная часть', 'Сборка целиком'],
  },
  {
    value: 'fingerstyle',
    label: 'Фингерстайл',
    hint: 'По частям аранжировки',
    sections: ['Вступление', 'Тема', 'Развитие', 'Кульминация', 'Кода', 'Сборка целиком'],
  },
] as const

export type SectionTemplate = (typeof SECTION_TEMPLATES)[number]['value']

/**
 * Части по выбранному шаблону.
 *
 * Принимает любую строку, а не только известный шаблон: значение приходит
 * из формы, то есть из браузера, и «нет такого шаблона» не должно ронять
 * создание разбора. Неизвестный шаблон означает «без частей» — куратор
 * добавит их руками, потеряв секунды, а не разбор.
 */
export function sectionsFromTemplate(template: string): string[] {
  return [...(SECTION_TEMPLATES.find((item) => item.value === template)?.sections ?? [])]
}

/** Шаблон «с нуля»: частей не создаётся, куратор размечает сам */
export const EMPTY_TEMPLATE = 'empty'

// ─── Воспроизведение части ───

export type PlaybackSource = {
  /** Какой файл проигрывать */
  assetId: string
  /** С какой секунды. 0 — с начала */
  startSec: number
  /** До какой секунды. `null` — до конца файла */
  endSec: number | null
}

type SectionTiming = {
  videoAssetId: string | null
  videoStartSec: number | null
  videoEndSec: number | null
}

/**
 * Что и с какого места проигрывать для этой части.
 *
 * Два способа записи разбора, и оба нужны:
 *
 *   своё видео у части     — куратор снял шесть роликов
 *   таймкод в общем видео  — куратор снял один ролик и разметил его
 *
 * Второй способ встречается чаще: так снимают, потому что так проще.
 * Первый даёт возможность переснять одну часть, не трогая остальные.
 *
 * `null` означает «проигрывать нечего»: у части нет ни своего видео,
 * ни общего у разбора. Это нормальное состояние черновика, а не ошибка, —
 * интерфейс показывает часть без кнопки воспроизведения.
 */
export function resolveSectionPlayback(
  section: SectionTiming,
  arrangementVideoAssetId: string | null,
): PlaybackSource | null {
  // Своё видео важнее: если куратор его загрузил, значит переснял
  // именно эту часть, и таймкоды общего ролика к ней уже не относятся
  if (section.videoAssetId) {
    return {
      assetId: section.videoAssetId,
      startSec: section.videoStartSec ?? 0,
      endSec: section.videoEndSec ?? null,
    }
  }

  if (!arrangementVideoAssetId) return null

  return {
    assetId: arrangementVideoAssetId,
    startSec: section.videoStartSec ?? 0,
    endSec: section.videoEndSec ?? null,
  }
}

/** Длительность части: явно указанная или выведенная из таймкодов */
export function sectionDuration(
  section: SectionTiming & { durationSec: number | null },
): number | null {
  if (section.durationSec !== null && section.durationSec > 0) return section.durationSec

  if (section.videoStartSec !== null && section.videoEndSec !== null) {
    const length = section.videoEndSec - section.videoStartSec
    return length > 0 ? length : null
  }

  return null
}

/** Сколько длится разбор целиком. Неизвестные части просто не считаются */
export function totalDuration(
  sections: readonly (SectionTiming & { durationSec: number | null })[],
): number {
  return sections.reduce((sum, section) => sum + (sectionDuration(section) ?? 0), 0)
}

/**
 * Длительность словами.
 *
 * До часа — «7:05», дольше — «1:12:30». Ведущий ноль у минут не ставится:
 * «07:05» читается как время суток.
 */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds))

  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60

  const pad = (value: number) => String(value).padStart(2, '0')

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

/** Примерное время занятия: «около 25 минут» */
export function estimateLabel(minutes: number | null): string | null {
  if (!minutes || minutes <= 0) return null
  if (minutes < 60) return `около ${minutes} мин.`

  const hours = Math.round(minutes / 30) / 2

  return `около ${hours} ч.`
}

// ─── Видимость ───

/**
 * Виден ли разбор обычному участнику.
 *
 * Запланированная публикация становится видимой сама, по времени:
 * иначе куратор, назначивший выход разбора на утро понедельника,
 * должен был бы прийти утром понедельника и нажать кнопку.
 */
export function isPubliclyVisible(
  status: PublicationStatus,
  publishedAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (status === 'published') return true
  if (status === 'scheduled') return publishedAt !== null && publishedAt <= now

  return false
}
