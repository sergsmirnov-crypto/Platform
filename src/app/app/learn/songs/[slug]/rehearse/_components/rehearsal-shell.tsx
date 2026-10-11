'use client'

import { X } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { MaterialView, PlaybackTicket } from '@/modules/media'
import type { SectionView } from '@/modules/songs'
import { clampLoop, loopFromSection, makeLoop } from '@/shared/playback'
import type { LoopRange } from '@/shared/playback'
import { formatTimecode } from '@/shared/utils/timecode'

import { PlaybackProvider, usePlayback } from '../../../../../_components/playback-context'
import { VideoPlayer } from '../../../../../_components/video-player'

import { LoopControls } from './loop-controls'
import { Metronome } from './metronome'
import { TabsPane } from './tabs-pane'

import type { PlaybackTracking } from '../../../../../_components/video-player'

/**
 * Режим репетиции.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЭКРАН ДЛЯ ЧЕЛОВЕКА, У КОТОРОГО ЗАНЯТЫ ОБЕ РУКИ
 *
 * Телефон стоит на пюпитре в полутора метрах, гитара в руках, играет
 * запись. Отсюда всё устройство этого экрана:
 *
 *   — кнопки от 44 пикселей и крупнее, попасть в них можно не глядя;
 *   — экран не гаснет, пока экран открыт;
 *   — выход — большой крест в углу, а не мелкая ссылка;
 *   — ничего лишнего: ни описания, ни похожих разборов, ни заметок.
 *     Всё это есть на обычной странице, и человек придёт туда, когда
 *     отложит гитару.
 * ─────────────────────────────────────────────────────────────────
 *
 * **Состояние живёт здесь, а не в глобальном хранилище.** Архитектурный
 * документ предполагал Zustand именно для этого экрана; при написании
 * оказалось, что он не нужен: всё состояние — отрезок, отметка, темп —
 * не покидает это поддерево и не переживает уход со страницы. Хранилище
 * добавило бы зависимость и слой, не решив ни одной задачи.
 */

type RehearsalShellProps = {
  ticket: PlaybackTicket
  sections: SectionView[]
  title: string
  artist: string
  songHref: string
  tempoBpm: number | null
  /** Только то, что можно показать: PDF и картинки */
  tabs: MaterialView[]
  tracking?: PlaybackTracking | undefined
}

/** Скорости крупными кнопками: при разборе их меняют по десять раз за занятие */
const RATES = [0.5, 0.75, 1, 1.25] as const

export function RehearsalShell(props: RehearsalShellProps) {
  return (
    <PlaybackProvider>
      <RehearsalBody {...props} />
    </PlaybackProvider>
  )
}

function RehearsalBody({
  ticket,
  sections,
  title,
  artist,
  songHref,
  tempoBpm,
  tabs,
  tracking,
}: RehearsalShellProps) {
  const playback = usePlayback()

  const [seekTo, setSeekTo] = useState<number | null>(null)
  const [pending, setPending] = useState<number | null>(null)
  const [loop, setLoop] = useState<LoopRange | null>(null)
  const [rate, setRate] = useState(1)

  useWakeLock()

  const jump = useCallback((seconds: number) => {
    // Одно и то же значение подряд не вызвало бы перемотку: повторное
    // нажатие должно возвращать к началу части
    setSeekTo(null)
    requestAnimationFrame(() => setSeekTo(seconds))
  }, [])

  function mark(): void {
    const current = playback?.()?.getCurrentTime()
    if (current === null || current === undefined) return

    if (pending === null) {
      setPending(current)
      return
    }

    const next = clampLoop(makeLoop(pending, current) ?? { from: 0, to: 0 }, playback?.()?.getDuration() ?? null) // prettier-ignore

    if (next) {
      setLoop(next)
      setPending(null)
      jump(next.from)
    }
  }

  function clearLoop(): void {
    setLoop(null)
    setPending(null)
  }

  function changeRate(value: number): void {
    setRate(value)
    playback?.()?.setRate(value)
  }

  return (
    <div className="bg-surface fixed inset-0 z-50 overflow-y-auto">
      <div className="mx-auto max-w-6xl p-4 lg:p-6">
        <header className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display truncate text-lg font-bold">{title}</h1>
            <p className="text-content-muted truncate text-sm">{artist}</p>
          </div>

          {/* Крупный крест, а не мелкая ссылка: попасть в маленький
              крестик человеку с гитарой в руках невозможно */}
          <Link
            href={songHref}
            aria-label="Выйти из режима репетиции"
            className="border-border hover:border-border-strong flex h-12 w-12 shrink-0 items-center justify-center rounded-full border"
          >
            <X size={22} aria-hidden />
          </Link>
        </header>

        {/*
          Три области, а не две. На большом экране слева видео
          с органами управления, справа — табы во всю высоту: аппликатуру
          читают глазами не отрываясь, ради этого режим и нужен.

          Без табов правая колонка исчезает, и видео занимает всё место —
          сетка задаётся на месте, а не двумя разными разметками
        */}
        <div className={tabs.length > 0 ? 'grid gap-4 lg:grid-cols-[3fr_2fr]' : 'grid gap-4'}>
          <div>
            <VideoPlayer
              ticket={ticket}
              seekTo={seekTo}
              title={title}
              tracking={tracking}
              loop={loop}
              showRateControls={false}
            />

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-content-subtle text-xs tracking-wide uppercase">Скорость</span>
              {RATES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => changeRate(value)}
                  aria-pressed={rate === value}
                  className={
                    rate === value
                      ? 'border-accent bg-accent text-accent-content inline-flex h-12 min-w-14 items-center justify-center rounded-full border font-medium'
                      : 'border-border text-content-muted hover:border-border-strong inline-flex h-12 min-w-14 items-center justify-center rounded-full border'
                  }
                >
                  {value}×
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <LoopControls pending={pending} loop={loop} onMark={mark} onClear={clearLoop} />

              <Metronome initialBpm={tempoBpm ?? 100} />
            </div>

            <div className="mt-4">
              <SectionList
                sections={sections}
                onJump={jump}
                onLoopSection={(range) => {
                  setLoop(range)
                  setPending(null)
                  jump(range.from)
                }}
              />
            </div>
          </div>

          {tabs.length > 0 ? <TabsPane materials={tabs} /> : null}
        </div>
      </div>
    </div>
  )
}

/**
 * Части разбора: перейти или зациклить целиком.
 *
 * Зациклить часть — самое частое желание после «перемотать к ней»:
 * соло отрабатывают кругами, а не один раз. Отдельная кнопка избавляет
 * от расстановки двух отметок там, где границы уже известны.
 */
function SectionList({
  sections,
  onJump,
  onLoopSection,
}: {
  sections: SectionView[]
  onJump: (seconds: number) => void
  onLoopSection: (range: LoopRange) => void
}) {
  const playable = sections.filter((section) => section.playback?.startSec !== undefined)

  if (playable.length === 0) return null

  return (
    <div className="border-border rounded-xl border p-4">
      <span className="text-content-subtle mb-3 block text-xs tracking-wide uppercase">
        Части разбора
      </span>

      <ol className="space-y-2">
        {sections.map((section) => {
          const start = section.playback?.startSec ?? null
          if (start === null) return null

          const range = loopFromSection({
            startSec: start,
            endSec: section.playback?.endSec ?? null,
          })

          return (
            <li key={section.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onJump(start)}
                className="border-border hover:border-border-strong flex h-12 min-w-0 flex-1 items-center justify-between gap-3 rounded-lg border px-3 text-left"
              >
                <span className="truncate">{section.title}</span>
                <span className="text-content-muted shrink-0 text-sm tabular-nums">
                  {formatTimecode(start)}
                </span>
              </button>

              {range ? (
                <button
                  type="button"
                  onClick={() => onLoopSection(range)}
                  aria-label={`Зациклить: ${section.title}`}
                  className="border-border hover:border-border-strong flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border"
                >
                  ↻
                </button>
              ) : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/**
 * Экран не гаснет, пока открыт режим репетиции.
 *
 * Разучивание такта занимает десять минут, из которых человек ни разу
 * не трогает телефон, — и телефон гаснет ровно посреди этого.
 *
 * Возможности может не быть: старый браузер, Safari до определённой
 * версии, отказ системы. Это не ошибка и не повод что-то сообщать —
 * экран будет гаснуть, как гаснул раньше.
 *
 * Разрешение теряется при сворачивании вкладки, поэтому запрашивается
 * заново при возвращении: иначе после ответа на звонок экран начинал бы
 * гаснуть до конца занятия.
 */
function useWakeLock(): void {
  const lockRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    let cancelled = false

    async function request(): Promise<void> {
      if (!('wakeLock' in navigator)) return

      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) {
          void lock.release()
          return
        }

        lockRef.current = lock
      } catch {
        // Отказ системы — обычное дело: низкий заряд, политика браузера
      }
    }

    function onVisibilityChange(): void {
      if (document.visibilityState === 'visible') void request()
    }

    void request()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      void lockRef.current?.release()
      lockRef.current = null
    }
  }, [])
}
