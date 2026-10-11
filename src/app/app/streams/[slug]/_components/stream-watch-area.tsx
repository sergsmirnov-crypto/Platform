'use client'

import { useState } from 'react'

import type { PlaybackTicket } from '@/modules/media'
import type { StreamChapter } from '@/modules/streams'

import { VideoPlayer } from '../../../_components/video-player'

import { ChapterList, ChaptersHeading } from './chapter-list'

import type { PlaybackTracking } from '../../../_components/video-player'

/**
 * Область просмотра записи: плеер и оглавление, связанные между собой.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗАЧЕМ ОБЪЕДИНЯТЬ, А НЕ СТАВИТЬ ДВА БЛОКА ПОДРЯД
 *
 * Нажатие на пункт оглавления должно перематывать уже загруженный
 * ролик. Раздельные блоки этого не дают: пришлось бы перезагружать
 * страницу с новым параметром времени, теряя буфер, позицию прокрутки
 * и отметку о просмотре.
 *
 * Тот же приём, что в области просмотра разбора. Общего компонента
 * из них не делаем: у разбора части — это структура урока с отметками
 * «разобрал», у эфира оглавление — навигация по разговору. Совпадает
 * сегодня разметка, а не смысл, и общий компонент развалился бы
 * на первом же расхождении.
 * ─────────────────────────────────────────────────────────────────
 *
 * Выбранный пункт в адрес не выносится: перемотка внутри ролика
 * не заслуживает записи в истории браузера, иначе кнопка «назад»
 * начнёт отматывать нажатия по оглавлению вместо возврата в архив.
 * Ссылка на момент записи при этом работает — она читается один раз
 * при открытии страницы (см. `startAt`).
 */

type StreamWatchAreaProps = {
  ticket: PlaybackTicket
  chapters: StreamChapter[]
  title: string
  tracking?: PlaybackTracking | undefined
}

export function StreamWatchArea({ ticket, chapters, title, tracking }: StreamWatchAreaProps) {
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [seekTo, setSeekTo] = useState<number | null>(null)

  function jumpTo(startSec: number, id: string) {
    setCurrentId(id)
    // Одно и то же значение подряд не вызвало бы перемотку: повторное
    // нажатие должно возвращать к началу пункта
    setSeekTo(null)
    requestAnimationFrame(() => setSeekTo(startSec))
  }

  return (
    <div className="space-y-8">
      <VideoPlayer ticket={ticket} seekTo={seekTo} title={title} tracking={tracking} />

      {chapters.length > 0 ? (
        <section>
          <ChaptersHeading interactive />
          <ChapterList chapters={chapters} onSelect={jumpTo} currentId={currentId} />
        </section>
      ) : null}
    </div>
  )
}
