'use client'

import { createContext, useContext, useMemo, useRef } from 'react'

/**
 * Связь между плеером и тем, что стоит рядом с ним.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗАЧЕМ ВООБЩЕ ПОНАДОБИЛСЯ ОБЩИЙ КОНТЕКСТ
 *
 * Заметке нужны две вещи от плеера: узнать текущее место записи
 * («отметить, где я сейчас») и перемотать к сохранённому («открыть
 * заметку про 2:14»). Плеер и заметки — соседи по странице, но не
 * родственники: ни один не содержит другого.
 *
 * Передать это свойствами через страницу нельзя — страница серверная,
 * а текущее место ролика существует только в браузере. Глобального
 * хранилища в проекте нет (ARCHITECTURE §11), и заводить его ради
 * одной кнопки было бы слишком.
 *
 * Контекст с одной ссылкой — самое маленькое, что решает задачу.
 * ─────────────────────────────────────────────────────────────────
 *
 * **Ссылка, а не состояние.** Управление плеером меняется ровно дважды
 * за жизнь страницы: когда плеер создался и когда исчез. Держать это
 * в состоянии значило бы перерисовывать всё поддерево при появлении
 * плеера — то есть в момент, когда он только начал загружаться.
 *
 * **Плеера может не быть вовсе.** Разбор без записи, урок без видео,
 * участник без подписки — заметки при этом остаются, просто без кнопки
 * «отметить место». Поэтому всё необязательное: `null` здесь норма,
 * а не ошибка.
 */

export type PlaybackController = {
  /** Текущее место записи в секундах или `null`, если плеер ещё не готов */
  getCurrentTime: () => number | null
  seekTo: (seconds: number) => void

  /**
   * Длительность записи или `null`, пока плеер её не сообщил.
   *
   * Нужна режиму репетиции: отрезок для зацикливания подрезается
   * по концу записи (шаг 10.5)
   */
  getDuration: () => number | null

  /** Скорость воспроизведения. Режим репетиции рисует свои крупные кнопки */
  setRate: (rate: number) => void

  play: () => void
  pause: () => void
}

type PlaybackContextValue = {
  register: (controller: PlaybackController | null) => void
  /**
   * Управление плеером, если он есть.
   *
   * Функция, а не значение: к моменту отрисовки соседей плеер обычно
   * ещё не создан, и значение было бы пустым навсегда.
   */
  controller: () => PlaybackController | null
}

const PlaybackContext = createContext<PlaybackContextValue | null>(null)

export function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<PlaybackController | null>(null)

  const value = useMemo<PlaybackContextValue>(
    () => ({
      register: (controller) => {
        ref.current = controller
      },
      controller: () => ref.current,
    }),
    [],
  )

  return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>
}

/**
 * Для плеера: сообщить о себе, если рядом кто-то слушает.
 *
 * Возвращает `null`, когда обёртки нет. Это обычное дело: тот же плеер
 * работает в предпросмотре редактора, где заметок не бывает.
 */
export function usePlaybackRegistration():
  ((controller: PlaybackController | null) => void) | null {
  return useContext(PlaybackContext)?.register ?? null
}

/** Для соседей плеера: получить управление, если плеер есть */
export function usePlayback(): (() => PlaybackController | null) | null {
  return useContext(PlaybackContext)?.controller ?? null
}
