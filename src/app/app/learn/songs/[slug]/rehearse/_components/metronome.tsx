'use client'

import { Minus, Plus, Volume2, VolumeX } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  beatsInWindow,
  BEATS_PER_BAR_OPTIONS,
  clampBpm,
  isAccent,
  MAX_BPM,
  MIN_BPM,
} from '@/shared/playback'
import type { BeatsPerBar } from '@/shared/playback'

/**
 * Метроном.
 *
 * ─────────────────────────────────────────────────────────────────
 * УДАРЫ ПЛАНИРУЮТСЯ ПО ЧАСАМ ЗВУКОВОЙ ПОДСИСТЕМЫ, А НЕ ПО ТАЙМЕРУ
 *
 * Очевидная реализация — `setInterval` на длительность доли — даёт
 * заметно кривой метроном: таймеры просыпаются с задержкой в десятки
 * миллисекунд, зависящей от загруженности вкладки. На 120 ударах
 * в минуту это слышно сразу, а метроном, который «плывёт», хуже, чем
 * его отсутствие: человек подстраивается под кривой счёт.
 *
 * Здесь удары ставятся в очередь звуковой подсистемы заранее,
 * с запасом. Часы этой подсистемы идут независимо от отрисовки, поэтому
 * заранее назначенный удар прозвучит точно вовремя. Таймер нужен только
 * чтобы время от времени подкладывать новые удары; его опоздание
 * на десятки миллисекунд при запасе в четверть секунды безразлично.
 * ─────────────────────────────────────────────────────────────────
 *
 * Звук синтезируется, а не берётся файлом: щелчок — это сто миллисекунд
 * затухающего тона, и тащить ради него файл на сервер незачем.
 */

/** На сколько вперёд заполняем очередь ударов */
const SCHEDULE_AHEAD_SECONDS = 0.25

/** Как часто подкладываем новые удары */
const SCHEDULER_INTERVAL_MS = 60

export function Metronome({ initialBpm }: { initialBpm: number }) {
  const [bpm, setBpm] = useState(initialBpm)
  const [beatsPerBar, setBeatsPerBar] = useState<BeatsPerBar>(4)
  const [running, setRunning] = useState(false)

  const contextRef = useRef<AudioContext | null>(null)
  const startTimeRef = useRef(0)
  const scheduledUntilRef = useRef(0)

  // Темп и размер читает планировщик, созданный один раз. Через ссылки —
  // иначе смена темпа на ходу потребовала бы пересоздавать планировщик,
  // а вместе с ним сбивался бы счёт долей
  const bpmRef = useRef(bpm)
  const beatsPerBarRef = useRef(beatsPerBar)

  useEffect(() => {
    bpmRef.current = bpm
  }, [bpm])

  useEffect(() => {
    beatsPerBarRef.current = beatsPerBar
  }, [beatsPerBar])

  const click = useCallback((context: AudioContext, time: number, accent: boolean) => {
    const oscillator = context.createOscillator()
    const gain = context.createGain()

    // Сильная доля выше и громче. Разница по высоте важнее разницы
    // по громкости: на тихой громкости акцент по громкости пропадает,
    // а по высоте слышен всегда
    oscillator.frequency.value = accent ? 1600 : 1100

    gain.gain.setValueAtTime(accent ? 0.5 : 0.28, time)
    // Плавное затухание, а не резкий обрыв: обрыв даёт щелчок,
    // который слышно как дефект
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06)

    oscillator.connect(gain)
    gain.connect(context.destination)

    oscillator.start(time)
    oscillator.stop(time + 0.07)
  }, [])

  useEffect(() => {
    if (!running) return

    // Звуковая подсистема создаётся по первому нажатию, а не при
    // открытии страницы: браузеры запрещают запускать звук без действия
    // человека, и созданный заранее контекст остался бы заблокированным
    const context = contextRef.current ?? new AudioContext()
    contextRef.current = context

    void context.resume()

    startTimeRef.current = context.currentTime + 0.1
    scheduledUntilRef.current = context.currentTime

    const timer = setInterval(() => {
      const until = context.currentTime + SCHEDULE_AHEAD_SECONDS

      const beats = beatsInWindow(
        scheduledUntilRef.current,
        until,
        startTimeRef.current,
        bpmRef.current,
      )

      for (const beat of beats) {
        click(context, beat.time, isAccent(beat.index, beatsPerBarRef.current))
      }

      scheduledUntilRef.current = until
    }, SCHEDULER_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [running, click])

  // Закрывая режим репетиции, звуковую подсистему отпускаем: оставленный
  // контекст держит устройство вывода занятым
  useEffect(() => {
    return () => {
      void contextRef.current?.close()
      contextRef.current = null
    }
  }, [])

  const step = (delta: number) => setBpm((current) => clampBpm(current + delta))

  return (
    <div className="border-border rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-content-subtle text-xs tracking-wide uppercase">Метроном</span>

        <button
          type="button"
          onClick={() => setRunning((current) => !current)}
          aria-pressed={running}
          className={
            running
              ? 'border-accent bg-accent text-accent-content inline-flex h-11 items-center gap-2 rounded-full border px-4 font-medium'
              : 'border-border hover:border-border-strong inline-flex h-11 items-center gap-2 rounded-full border px-4'
          }
        >
          {running ? <Volume2 size={18} aria-hidden /> : <VolumeX size={18} aria-hidden />}
          {running ? 'Стоп' : 'Пуск'}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => step(-5)}
          aria-label="Медленнее"
          disabled={bpm <= MIN_BPM}
          className="border-border hover:border-border-strong flex h-12 w-12 items-center justify-center rounded-full border disabled:opacity-40"
        >
          <Minus size={20} aria-hidden />
        </button>

        <div className="flex-1 text-center">
          <span className="font-display block text-3xl font-bold tabular-nums">{bpm}</span>
          <span className="text-content-muted text-xs">ударов в минуту</span>
        </div>

        <button
          type="button"
          onClick={() => step(5)}
          aria-label="Быстрее"
          disabled={bpm >= MAX_BPM}
          className="border-border hover:border-border-strong flex h-12 w-12 items-center justify-center rounded-full border disabled:opacity-40"
        >
          <Plus size={20} aria-hidden />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-content-subtle text-xs">Доли в такте</span>
        {BEATS_PER_BAR_OPTIONS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setBeatsPerBar(value)}
            aria-pressed={beatsPerBar === value}
            className={
              beatsPerBar === value
                ? 'border-accent bg-accent text-accent-content h-9 w-9 rounded-full border text-sm font-medium'
                : 'border-border text-content-muted hover:border-border-strong h-9 w-9 rounded-full border text-sm'
            }
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  )
}
