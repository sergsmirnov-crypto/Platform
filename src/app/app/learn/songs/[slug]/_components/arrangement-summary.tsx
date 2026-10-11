import { estimateLabel, formatDuration, songStrings } from '@/modules/songs'
import type { ArrangementView } from '@/modules/songs'
import { Avatar, PropertyList } from '@/ui'
import type { Property } from '@/ui'

/**
 * Карточка выбранного варианта: куратор, «что освоишь», время.
 *
 * Отвечает на вопрос «стоит ли за это браться сегодня». Два числа
 * рядом намеренно разные по смыслу:
 *
 *   длительность — сколько идёт видео
 *   время на разбор — сколько человек потратит на самом деле
 *
 * Второе больше первого в разы, и куратор указывает его сам. Показывать
 * одну длительность значило бы обещать, что песня разбирается за сорок
 * минут, и раз за разом обманывать.
 *
 * Имя куратора здесь ссылкой не сделано: страница куратора появится
 * на Этапе 8, и ссылка в никуда хуже её отсутствия.
 */

type ArrangementSummaryProps = {
  arrangement: ArrangementView
}

export function ArrangementSummary({ arrangement }: ArrangementSummaryProps) {
  const properties: Property[] = [
    {
      label: songStrings.song.totalTime,
      value: arrangement.totalDurationSec > 0 ? formatDuration(arrangement.totalDurationSec) : null,
    },
    {
      label: songStrings.song.estimate,
      value: estimateLabel(arrangement.estimatedMinutes),
    },
    {
      label: songStrings.song.structure,
      value:
        arrangement.sections.length > 0
          ? songStrings.song.parts(arrangement.sections.length)
          : null,
    },
  ]

  return (
    <div className="border-border bg-surface-sunken rounded-lg border p-5">
      {arrangement.curator ? (
        <div className="flex items-center gap-3">
          <Avatar src={arrangement.curator.avatarUrl} alt={arrangement.curator.displayName} />
          <div className="min-w-0">
            <p className="text-content-subtle text-xs tracking-wide uppercase">
              {songStrings.song.curator}
            </p>
            <p className="truncate font-medium">{arrangement.curator.displayName}</p>
          </div>
        </div>
      ) : null}

      {arrangement.summary ? (
        <div className={arrangement.curator ? 'mt-5' : ''}>
          <p className="text-content-subtle text-xs tracking-wide uppercase">
            {songStrings.song.about}
          </p>
          <p className="mt-1 leading-relaxed">{arrangement.summary}</p>
        </div>
      ) : null}

      <PropertyList
        items={properties}
        layout="stacked"
        className="border-border mt-5 border-t pt-5"
      />
    </div>
  )
}
