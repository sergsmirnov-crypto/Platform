'use client'

import KinescopePlayer from '@kinescope/player-iframe-api-loader/react/KinescopePlayer'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { PlaybackTicket } from '@/modules/media'
import { shouldRestartLoop } from '@/shared/playback'
import type { LoopRange } from '@/shared/playback'

import { recordPlaybackAction } from '../_actions/progress'

import { usePlaybackRegistration } from './playback-context'

/**
 * Плеер видео.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЕДИНСТВЕННЫЙ КОМПОНЕНТ СТРАНИЦЫ, РАБОТАЮЩИЙ В БРАУЗЕРЕ
 *
 * Всё остальное на страницах разборов и уроков собирается на сервере.
 * Плееру браузер нужен по существу: переход к части разбора, скорость
 * воспроизведения и полноэкранный режим невозможно сделать ссылками.
 *
 * Лежит в общих компонентах закрытой зоны, а не рядом со страницей
 * песни: тот же плеер показывает урок курса и запись эфира.
 *
 * Компонент намеренно ничего не знает про Kinescope, кроме библиотеки
 * плеера: адрес, водяной знак и оглавление приходят готовыми, собранными
 * на сервере. Смена хостинга заменит один файл в `shared/video`,
 * а не этот компонент.
 * ─────────────────────────────────────────────────────────────────
 *
 * **Про водяной знак.** Он задаётся настройками плеера, а не адресом,
 * поэтому убрать его правкой строки в браузере нельзя. Режим `random` —
 * текст всплывает в случайных местах экрана: перекрыть его при записи
 * не выйдет, а обрезать кадр — значит обрезать и сам разбор.
 */

/**
 * Что запоминать и куда возвращать.
 *
 * Необязательно: плеер без этого работает, просто ничего не помнит.
 * Так он останется пригодным для предпросмотра в редакторе куратора,
 * где отмечать прогресс было бы неверно.
 */
export type PlaybackTracking = {
  entityType: 'lesson' | 'arrangement' | 'stream'
  entityId: string
  /** Секунда, с которой продолжить. `0` — начать сначала */
  resumeAt: number
}

type VideoPlayerProps = {
  ticket: PlaybackTicket
  /** Секунда, к которой нужно перейти. Меняется при выборе части разбора */
  seekTo?: number | null
  title?: string
  tracking?: PlaybackTracking | undefined

  /**
   * Отрезок для зацикливания или `null`.
   *
   * Проверяется в событии времени плеера, а не опросом по таймеру:
   * опрос дал бы задержку до собственного шага, и петля каждый раз
   * заезжала бы за край на разную величину (шаг 10.5)
   */
  loop?: LoopRange | null

  /**
   * Показывать ли собственные кнопки скорости.
   *
   * Режим репетиции рисует свои — крупные, под палец человека
   * с гитарой в руках, — и просит плеер свои не показывать
   */
  showRateControls?: boolean
}

/** Скорости для разбора: медленнее — чтобы успеть, быстрее — чтобы повторить */
const RATES = [0.5, 0.75, 1, 1.25, 1.5] as const

/**
 * Как часто отправлять отметку о просмотре.
 *
 * Событие времени приходит от плеера по нескольку раз в секунду. Слать
 * столько же запросов — значит положить сервер силами трёх человек,
 * смотрящих видео.
 *
 * Пятнадцать секунд — компромисс: столько человек теряет, если закроет
 * вкладку не вовремя, и это незаметно. Меньше — лишняя нагрузка,
 * больше — «продолжить» начинает возвращать заметно назад.
 */
const REPORT_EVERY_SECONDS = 15

/** Ниже этой секунды возвращать некуда: человек только начал */
const RESUME_MIN_SECONDS = 5

export function VideoPlayer({
  ticket,
  seekTo,
  title,
  tracking,
  loop = null,
  showRateControls = true,
}: VideoPlayerProps) {
  const playerRef = useRef<Kinescope.IframePlayer.Player | null>(null)
  const [rate, setRate] = useState(1)

  // Кому сообщить о себе, чтобы соседние блоки могли спросить текущее
  // место записи и перемотать. Обычно это заметки; если обёртки рядом
  // нет — `null`, и плеер работает как раньше
  const register = usePlaybackRegistration()

  // Текущее место держим в ссылке: событие времени приходит от плеера
  // по нескольку раз в секунду, и превращать его в состояние — значит
  // перерисовывать страницу столько же раз
  const currentTimeRef = useRef(0)

  // Сведения для отметки держим в ссылке, а не в состоянии: они нужны
  // обработчику события плеера, а перерисовывать страницу под работающим
  // плеером незачем — и опасно, он может пересоздаться.
  //
  // Обновляется в эффекте, а не прямо при отрисовке: React запрещает
  // трогать ссылки во время отрисовки, и это не придирка — при
  // прерванной отрисовке значение оказалось бы от несостоявшегося
  // состояния
  const trackingRef = useRef(tracking)

  useEffect(() => {
    trackingRef.current = tracking
  }, [tracking])

  const lastSentRef = useRef(0)
  const durationRef = useRef<number | null>(null)

  // Отрезок держим в ссылке по той же причине, что и всё остальное здесь:
  // его читает обработчик события плеера, созданный один раз
  const loopRef = useRef(loop)

  useEffect(() => {
    loopRef.current = loop
  }, [loop])

  /**
   * Отправка отметки с прореживанием.
   *
   * Считаем по времени ролика, а не по часам: при скорости 1.5×
   * пятнадцать секунд ролика проходят за десять, и отметки должны
   * следовать за содержимым, а не за секундомером.
   *
   * Ошибку глотаем намеренно. Отметка о просмотре — не то, ради чего
   * стоит показывать человеку сообщение поверх видео: следующая отметка
   * придёт через пятнадцать секунд и, скорее всего, дойдёт.
   */
  const report = useCallback((currentTime: number, options?: { force?: boolean }) => {
    const target = trackingRef.current
    if (!target) return

    const elapsed = Math.abs(currentTime - lastSentRef.current)
    if (!options?.force && elapsed < REPORT_EVERY_SECONDS) return

    lastSentRef.current = currentTime

    void recordPlaybackAction({
      entityType: target.entityType,
      entityId: target.entityId,
      positionSec: Math.round(currentTime),
      durationSec: durationRef.current === null ? null : Math.round(durationRef.current),
    }).catch(() => undefined)
  }, [])

  const handleCreate = useCallback(
    (player: Kinescope.IframePlayer.Player) => {
      playerRef.current = player

      register?.({
        // `null`, пока ролик не начали проигрывать: подставить нулевую
        // секунду вместо «не знаю» — значит поставить заметку в начало
        // записи, которую человек ещё не открыл
        getCurrentTime: () => (currentTimeRef.current > 0 ? currentTimeRef.current : null),
        seekTo: (seconds: number) => {
          void player.seekTo(seconds)
          void player.play()
        },
        getDuration: () => durationRef.current,
        setRate: (value: number) => {
          setRate(value)
          void player.setPlaybackRate(value)
        },
        play: () => void player.play(),
        pause: () => void player.pause(),
      })

      const events = player.Events

      // Возврат к месту остановки. Делается по готовности, а не сразу:
      // до этого момента плеер ещё не знает длительность и перемотку
      // молча проглатывает
      player.on(events.Ready, () => {
        const resumeAt = trackingRef.current?.resumeAt ?? 0

        // Пропускаем самое начало и самый конец. «Продолжить» с четвёртой
        // секунды раздражает, а с последней — возвращает к титрам вместо
        // урока
        if (resumeAt > RESUME_MIN_SECONDS) {
          void player.seekTo(resumeAt)
        }
      })

      player.on(events.DurationChange, ({ data }) => {
        durationRef.current = data.duration
      })

      player.on(events.TimeUpdate, ({ data }) => {
        currentTimeRef.current = data.currentTime

        // Зацикливание проверяется здесь, до отметки о просмотре:
        // прыжок назад не должен попасть в прогресс как откат
        if (shouldRestartLoop(data.currentTime, loopRef.current)) {
          void player.seekTo(loopRef.current?.from ?? 0)
          return
        }

        report(data.currentTime)
      })

      // Досмотрел до конца — отмечаем сразу, не дожидаясь очередного
      // отсчёта: событий времени после конца ролика больше не будет
      player.on(events.Ended, () => {
        const duration = durationRef.current
        if (duration) report(duration, { force: true })
      })
    },
    [report, register],
  )

  const handleDestroy = useCallback(() => {
    playerRef.current = null
    register?.(null)
  }, [register])

  // Переход к части разбора. Плеер живёт дольше выбранной части, поэтому
  // перемотка — это побочный эффект, а не пересоздание плеера: пересоздание
  // обрывало бы загрузку и заново показывало заставку
  useEffect(() => {
    if (seekTo === null || seekTo === undefined) return

    void playerRef.current?.seekTo(seekTo)
  }, [seekTo])

  const changeRate = useCallback((value: number) => {
    setRate(value)
    void playerRef.current?.setPlaybackRate(value)
  }, [])

  return (
    <div className="space-y-3">
      <div className="bg-surface-sunken overflow-hidden rounded-lg">
        <KinescopePlayer
          className="aspect-video w-full"
          onCreate={handleCreate}
          onDestroy={handleDestroy}
          options={{
            url: ticket.url,
            size: { width: '100%', height: '100%' },
            behavior: {
              playsInline: true,
              autoPause: true,
              // Позицию просмотра платформа помнит сама, на сервере:
              // своя память переживает смену устройства, а память
              // браузера — нет. Начал на компьютере, продолжил
              // с телефона на пюпитре — это обычный сценарий
              localStorage: { time: false },
            },
            ui: {
              language: 'ru',
              playbackRateButton: true,
              watermark: {
                text: ticket.watermark,
                mode: 'random',
              },
            },
            playlist: [
              {
                ...(title ? { title } : {}),
                ...(ticket.chapters.length > 0 ? { chapters: ticket.chapters } : {}),
              },
            ],
          }}
        />
      </div>

      {/* Скорость вынесена наружу плеера: при разборе её меняют по десять
          раз за занятие, и лезть за ней в меню настроек — мучение */}
      <div className={showRateControls ? 'flex items-center gap-2' : 'hidden'}>
        <span className="text-content-subtle text-xs tracking-wide uppercase">Скорость</span>
        {RATES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => changeRate(value)}
            aria-pressed={rate === value}
            className={
              rate === value
                ? 'border-accent bg-accent text-accent-content inline-flex h-9 items-center rounded-full border px-3 text-sm font-medium'
                : 'border-border text-content-muted hover:border-border-strong inline-flex h-9 items-center rounded-full border px-3 text-sm'
            }
          >
            {value}×
          </button>
        ))}
      </div>
    </div>
  )
}
