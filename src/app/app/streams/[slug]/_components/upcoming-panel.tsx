import { CalendarPlus, Radio } from 'lucide-react'

import { formatStreamDateTime, streamStrings, timeUntil } from '@/modules/streams'
import type { StreamView } from '@/modules/streams'
import { routes } from '@/shared/routes'
import { LinkButton } from '@/ui'

import { LocalTime } from '../../_components/local-time'

/**
 * Верх страницы будущего эфира: когда, куда идти, как не забыть.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ «В КАЛЕНДАРЬ», А НЕ «НАПОМНИТЬ»
 *
 * Напоминания платформы появятся на Этапе 10 — им нужны очередь
 * отправки, настройки каналов и защита от потока сообщений. Кнопка,
 * которая ничего не напоминает, хуже отсутствующей: один раз обманув,
 * она перестаёт работать навсегда.
 *
 * Файл календаря даёт человеку то же самое сегодня и без нашего
 * участия. Когда появятся уведомления, «Напомнить» встанет рядом,
 * а эта кнопка останется: календарём пользуются и те, кто отключил
 * все уведомления.
 * ─────────────────────────────────────────────────────────────────
 *
 * Кнопка «Присоединиться» открывается за пятнадцать минут до начала
 * (правило `canJoin`). До этого на её месте — объяснение, а не серая
 * кнопка: серая кнопка вызывает вопрос «почему нельзя», объяснение
 * на него уже отвечает.
 */

export function UpcomingPanel({ stream }: { stream: StreamView }) {
  const until = timeUntil(stream.startsAt, new Date())
  const isLive = stream.phase === 'live'

  return (
    <section className="border-border bg-surface-raised rounded-xl border p-6">
      <div className="flex flex-wrap items-center gap-3">
        {isLive ? (
          <span className="bg-danger text-danger-content inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold">
            <Radio size={16} aria-hidden />
            {streamStrings.phase.live}
          </span>
        ) : (
          until && <span className="text-content-muted text-sm">{until}</span>
        )}
      </div>

      <p className="font-display mt-3 text-xl font-bold">
        {formatStreamDateTime(stream.startsAt)} {streamStrings.page.timezone}
      </p>

      <p className="text-content-subtle mt-1 text-sm">
        <LocalTime startsAt={stream.startsAt} />
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {stream.canJoin && stream.joinUrl ? (
          <>
            {/* Внешняя ссылка: трансляция идёт в Telegram или Zoom,
                своей у платформы нет и не планируется */}
            <LinkButton href={stream.joinUrl} target="_blank" rel="noopener noreferrer">
              {streamStrings.page.join}
            </LinkButton>
            <span className="text-content-subtle text-sm">{streamStrings.page.joinHint}</span>
          </>
        ) : (
          <>
            <LinkButton
              href={routes.api.streamCalendar(stream.slug)}
              variant="secondary"
              // Скачивание, а не переход: без этого браузер откроет файл
              // как текст, и человек увидит содержимое вместо календаря
              download
            >
              <CalendarPlus size={16} aria-hidden />
              {streamStrings.page.calendar}
            </LinkButton>

            <span className="text-content-subtle max-w-xs text-sm">
              {stream.joinUrl ? streamStrings.page.joinClosed : streamStrings.page.calendarHint}
            </span>
          </>
        )}
      </div>
    </section>
  )
}
