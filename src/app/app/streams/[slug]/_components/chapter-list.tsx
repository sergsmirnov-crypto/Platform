import { streamStrings } from '@/modules/streams'
import type { StreamChapter } from '@/modules/streams'

/**
 * Оглавление записи.
 *
 * ─────────────────────────────────────────────────────────────────
 * ТО, РАДИ ЧЕГО СУЩЕСТВУЕТ АРХИВ
 *
 * Эфир идёт полтора часа, и целиком его не смотрит никто. Без
 * оглавления запись — это файл, который «надо будет как-нибудь
 * посмотреть»; с оглавлением — справочник, в котором за десять секунд
 * находится нужный кусок (PRD v0.1 §12, пункт 3).
 * ─────────────────────────────────────────────────────────────────
 *
 * Компонент показывает только разметку и ничего не решает: обработчик
 * перехода приходит сверху, из области просмотра. Так тот же список
 * выводится и без плеера — участнику без подписки, которому оглавление
 * остаётся видно. Это намеренно: оглавление и есть лучший довод
 * продлить подписку.
 */

type ChapterListProps = {
  chapters: StreamChapter[]
  /** Куда перейти. Без обработчика список остаётся просто списком */
  onSelect?: ((startSec: number, id: string) => void) | undefined
  currentId?: string | null
}

export function ChapterList({ chapters, onSelect, currentId = null }: ChapterListProps) {
  if (chapters.length === 0) return null

  return (
    <ol className="border-border divide-border divide-y overflow-hidden rounded-lg border">
      {chapters.map((chapter, index) => {
        const row = <ChapterRow chapter={chapter} index={index} isCurrent={chapter.id === currentId} /> // prettier-ignore

        return (
          <li key={chapter.id}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(chapter.startSec, chapter.id)}
                className="hover:bg-surface-hover w-full cursor-pointer text-left transition-colors"
              >
                {row}
              </button>
            ) : (
              row
            )}
          </li>
        )
      })}
    </ol>
  )
}

function ChapterRow({
  chapter,
  index,
  isCurrent,
}: {
  chapter: StreamChapter
  index: number
  isCurrent: boolean
}) {
  return (
    <div className="flex min-h-14 w-full items-center gap-4 px-4 py-3">
      <span className="text-content-subtle w-5 shrink-0 text-sm tabular-nums">{index + 1}</span>

      <span className={`min-w-0 flex-1 ${isCurrent ? 'font-semibold' : 'font-medium'}`}>
        {chapter.title}
      </span>

      {/* Таймкод собран на сервере: в браузере он не меняется,
          и пересчитывать его при каждой отрисовке незачем */}
      <span className="text-content-muted shrink-0 text-sm tabular-nums">{chapter.timecode}</span>
    </div>
  )
}

/** Подпись над оглавлением: одна и та же над плеером и без него */
export function ChaptersHeading({ interactive }: { interactive: boolean }) {
  return (
    <>
      <h2 className="font-display mb-1 text-xl font-bold">{streamStrings.page.chapters}</h2>
      {interactive ? (
        <p className="text-content-muted mb-4 text-sm">{streamStrings.page.chaptersHint}</p>
      ) : (
        <div className="mb-4" />
      )}
    </>
  )
}
