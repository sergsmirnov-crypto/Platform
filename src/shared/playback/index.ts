/**
 * Воспроизведение: расчёты, общие для плеера и режима репетиции.
 *
 * Ни браузера, ни плеера — только числа. Работа со звуком и с плеером
 * живёт в компонентах; сюда вынесено всё, что можно проверить тестом.
 */
export { clampLoop, loopFromSection, makeLoop, MIN_LOOP_SECONDS, shouldRestartLoop } from './loop'
export type { LoopRange } from './loop'

export {
  beatInterval,
  beatsInWindow,
  BEATS_PER_BAR_OPTIONS,
  clampBpm,
  defaultBpm,
  isAccent,
  MAX_BPM,
  MIN_BPM,
} from './metronome'
export type { BeatsPerBar } from './metronome'
