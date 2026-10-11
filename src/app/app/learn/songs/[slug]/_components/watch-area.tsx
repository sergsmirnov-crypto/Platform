'use client'

import { useState } from 'react'

import type { PlaybackTicket } from '@/modules/media'
import { songStrings } from '@/modules/songs'
import type { SectionView } from '@/modules/songs'

import { VideoPlayer } from '../../../../_components/video-player'

import { SectionRow } from './section-row'

import type { PlaybackTracking } from '../../../../_components/video-player'

/**
 * Область просмотра: плеер и структура разбора, связанные между собой.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗАЧЕМ ОБЪЕДИНЯТЬ, А НЕ ОСТАВИТЬ ДВА БЛОКА
 *
 * Разбор длится час, и целиком его никто не смотрит. Человек приходит
 * доучить соло, к которому подступался вчера. Список частей рядом
 * с плеером превращает запись в оглавление: нажал «Соло» — плеер
 * перемотался, страница не перезагрузилась, место в разборе не потеряно.
 *
 * Раздельные блоки этого не дают: пришлось бы перезагружать страницу
 * с параметром времени, теряя загруженный буфер и позицию прокрутки.
 * ─────────────────────────────────────────────────────────────────
 *
 * Состояние здесь минимальное — одна выбранная часть. В адрес оно
 * не выносится намеренно: перемотка внутри ролика не заслуживает записи
 * в истории браузера, иначе кнопка «назад» вместо возврата в каталог
 * начнёт отматывать нажатия по частям.
 */

type WatchAreaProps = {
  ticket: PlaybackTicket
  sections: SectionView[]
  title: string
  tracking?: PlaybackTracking | undefined
}

export function WatchArea({ ticket, sections, title, tracking }: WatchAreaProps) {
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [seekTo, setSeekTo] = useState<number | null>(null)

  // Части со своим отдельным роликом перемоткой не открываются: там другое
  // видео, а не отрезок этого. До появления переключения роликов такие
  // части остаются в списке, но без перехода
  const jumpable = (section: SectionView) => section.playback?.startSec ?? null

  return (
    <div className="space-y-8">
      <VideoPlayer ticket={ticket} seekTo={seekTo} title={title} tracking={tracking} />

      <section>
        <h2 className="font-display mb-4 text-xl font-bold">{songStrings.song.structure}</h2>

        <ol className="border-border divide-border divide-y overflow-hidden rounded-lg border">
          {sections.map((section, index) => {
            const start = jumpable(section)

            return (
              <li key={section.id} id={`section-${section.id}`} className="scroll-mt-24">
                {start === null ? (
                  <SectionRow section={section} index={index} />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentId(section.id)
                      // Одно и то же значение подряд не вызвало бы перемотку:
                      // повторное нажатие должно возвращать к началу части
                      setSeekTo(null)
                      requestAnimationFrame(() => setSeekTo(start))
                    }}
                    className="hover:bg-surface-hover w-full cursor-pointer transition-colors"
                  >
                    <SectionRow
                      section={section}
                      index={index}
                      isCurrent={section.id === currentId}
                    />
                  </button>
                )}
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}
