/**
 * Метроном: расчёты без звука.
 *
 * Звук живёт в браузере и в тестах не проверяется. Всё, что можно
 * посчитать, посчитано здесь — иначе единственным способом убедиться,
 * что метроном не врёт, была бы гитара и слух.
 */

/** Медленнее не отрабатывают даже самые тяжёлые места */
export const MIN_BPM = 40

/** Быстрее человеческая рука на гитаре всё равно не успевает */
export const MAX_BPM = 240

/** Сколько долей в такте бывает у песен, которые здесь разбирают */
export const BEATS_PER_BAR_OPTIONS = [2, 3, 4, 6] as const

export type BeatsPerBar = (typeof BEATS_PER_BAR_OPTIONS)[number]

/** Темп в допустимых границах. Значение приходит из поля ввода */
export function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return 100

  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)))
}

/** Длительность одной доли в секундах */
export function beatInterval(bpm: number): number {
  return 60 / clampBpm(bpm)
}

/**
 * Сильная ли доля.
 *
 * Первая в такте — сильная, остальные слабые. Без выделения сильной
 * доли метроном перестаёт помогать: человек слышит равномерный стук
 * и теряет, где начинается такт, — а именно за этим метроном и включают.
 */
export function isAccent(beatIndex: number, beatsPerBar: BeatsPerBar): boolean {
  return beatIndex % beatsPerBar === 0
}

/**
 * Время следующих долей для упреждающего планирования.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ДОЛИ ПЛАНИРУЮТСЯ ЗАРАНЕЕ, А НЕ ПО ТАЙМЕРУ
 *
 * Очевидная реализация — `setInterval` на длительность доли — даёт
 * заметно кривой метроном: таймеры в браузере просыпаются с задержкой
 * в десятки миллисекунд, зависящей от загруженности вкладки. На 120
 * ударах в минуту это слышно сразу.
 *
 * Правильный способ — планировать удары по часам звуковой подсистемы,
 * которые идут независимо от отрисовки, и делать это с запасом вперёд.
 * Таймер тогда нужен только для того, чтобы время от времени
 * подкладывать новые удары в очередь; опоздание таймера на десятки
 * миллисекунд при запасе в четверть секунды ничего не портит.
 * ─────────────────────────────────────────────────────────────────
 *
 * @param fromTime  время звуковых часов, с которого планируем
 * @param untilTime до какого времени заполнять очередь
 * @param startTime когда прозвучала нулевая доля
 */
export function beatsInWindow(
  fromTime: number,
  untilTime: number,
  startTime: number,
  bpm: number,
): { index: number; time: number }[] {
  const interval = beatInterval(bpm)
  if (untilTime <= fromTime) return []

  const firstIndex = Math.max(0, Math.ceil((fromTime - startTime) / interval))
  const beats: { index: number; time: number }[] = []

  for (let index = firstIndex; ; index += 1) {
    const time = startTime + index * interval

    if (time > untilTime) break

    // Защита от бесконечного цикла при испорченных входных данных:
    // такт длиной в час никому не нужен, а зависшая вкладка — беда
    if (beats.length > 512) break

    beats.push({ index, time })
  }

  return beats
}

/**
 * Темп из карточки песни.
 *
 * Если у разбора темп не проставлен, берём сто ударов — это середина
 * ходового диапазона. Пустое поле было бы хуже: человек, включивший
 * метроном, ждёт стука, а не формы для заполнения.
 */
export function defaultBpm(songTempo: number | null): number {
  return clampBpm(songTempo ?? 100)
}
