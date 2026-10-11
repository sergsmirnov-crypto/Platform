import { plural } from '@/shared/utils/plural'

import type { StreamState } from './schema'

/**
 * Правила эфиров.
 *
 * Ни базы, ни сети — только решения о том, что показывать. Отсюда
 * и тесты: ошибка здесь означает, что человек пришёл к назначенному
 * времени и не нашёл кнопку, или увидел «идёт сейчас» у эфира недельной
 * давности.
 */

/**
 * Что показывать про эфир прямо сейчас.
 *
 * ─────────────────────────────────────────────────────────────────
 * СОСТОЯНИЕ СКЛАДЫВАЕТСЯ ИЗ ЭТАПА И ВРЕМЕНИ, А НЕ ИЗ ОДНОГО ЭТАПА
 *
 * Этап (`state`) ставит куратор руками: только он знает, начался эфир
 * или задерживается. Но полагаться на него одного нельзя — куратор
 * закончит эфир и уйдёт спать, не переключив ничего, и платформа
 * до утра будет обещать участникам трансляцию.
 *
 * Поэтому: этап решает, время подстраховывает.
 * ─────────────────────────────────────────────────────────────────
 */
export type StreamPhase =
  /** Ещё не начался: показываем дату и «напомнить» */
  | 'upcoming'
  /** Идёт прямо сейчас: показываем кнопку «присоединиться» */
  | 'live'
  /** Закончился, записи ещё нет */
  | 'finished'
  /** Есть запись: показываем плеер и оглавление */
  | 'recorded'
  /** Отменён */
  | 'cancelled'

/**
 * Сколько эфир считается идущим без обновления от куратора.
 *
 * Три часа: полтора часа самого эфира плюс запас на «затянулись
 * с вопросами». Дольше — почти наверняка забыли переключить.
 */
export const LIVE_GRACE_HOURS = 3

export type StreamStateInput = {
  state: StreamState
  startsAt: Date
  endedAt: Date | null
  hasVideo: boolean
}

export function streamPhase(stream: StreamStateInput, now: Date): StreamPhase {
  if (stream.state === 'cancelled') return 'cancelled'

  // Запись важнее этапа: если видео выложено, эфир точно прошёл,
  // что бы ни стояло в поле
  if (stream.hasVideo) return 'recorded'

  if (stream.state === 'recorded') return 'finished'

  if (stream.state === 'live') {
    const limit = new Date(stream.startsAt.getTime() + LIVE_GRACE_HOURS * 60 * 60 * 1000)

    // Куратор забыл переключить — показываем «закончился», а не вечную
    // кнопку «присоединиться», ведущую в пустую комнату
    return now > limit ? 'finished' : 'live'
  }

  return now < stream.startsAt ? 'upcoming' : 'finished'
}

/** Место эфира: в ближайших или в архиве */
export function isUpcoming(phase: StreamPhase): boolean {
  return phase === 'upcoming' || phase === 'live'
}

/**
 * Можно ли присоединиться.
 *
 * Кнопка появляется незадолго до начала, а не в момент: люди приходят
 * заранее, и «ещё нельзя» за две минуты до эфира выглядит как поломка.
 */
const JOIN_OPENS_MINUTES = 15

export function canJoin(
  stream: { joinUrl: string | null; startsAt: Date },
  phase: StreamPhase,
  now: Date,
): boolean {
  if (!stream.joinUrl) return false
  if (phase === 'live') return true
  if (phase !== 'upcoming') return false

  const opensAt = new Date(stream.startsAt.getTime() - JOIN_OPENS_MINUTES * 60 * 1000)

  return now >= opensAt
}

/**
 * Сколько осталось до эфира, человеческими словами.
 *
 * Точность здесь не нужна и вредна: «через 2 дня» полезнее, чем
 * «через 47 часов 12 минут». Ближе к началу точность растёт — тогда
 * она и начинает что-то значить.
 */
export function timeUntil(startsAt: Date, now: Date): string | null {
  const minutes = Math.round((startsAt.getTime() - now.getTime()) / 60000)

  if (minutes < 0) return null
  if (minutes < 1) return 'начинается'
  if (minutes < 60) return `через ${minutes} мин`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `через ${hours} ${plural(hours, 'час', 'часа', 'часов')}`

  const days = Math.round(hours / 24)

  return `через ${days} ${plural(days, 'день', 'дня', 'дней')}`
}

/** Длительность записи «1 ч 32 мин» — по ней решают, хватит ли времени */
export function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null

  const totalMinutes = Math.round(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) return `${minutes} мин`
  if (minutes === 0) return `${hours} ч`

  return `${hours} ч ${minutes} мин`
}
