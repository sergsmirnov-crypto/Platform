import { formatDuration } from '@/modules/songs'
import type { SectionView } from '@/modules/songs'

/**
 * Одна часть разбора.
 *
 * Вынесена отдельно, потому что рисуется в двух разных местах: обычным
 * списком, когда видео ещё нет, и внутри области просмотра, где нажатие
 * перематывает плеер. Разметка при этом обязана быть одинаковой — иначе
 * появление видео у разбора необъяснимо меняет вид страницы.
 */

type SectionRowProps = {
  section: SectionView
  index: number
  /** Проигрывается ли эта часть прямо сейчас */
  isCurrent?: boolean
}

export function SectionRow({ section, index, isCurrent = false }: SectionRowProps) {
  return (
    <div className="flex w-full items-baseline gap-4 p-4 text-left">
      <span
        className={
          isCurrent
            ? 'text-accent w-6 shrink-0 text-sm font-medium tabular-nums'
            : 'text-content-subtle w-6 shrink-0 text-sm tabular-nums'
        }
      >
        {index + 1}
      </span>

      <div className="min-w-0 flex-1">
        <p className={isCurrent ? 'text-accent font-medium' : 'font-medium'}>{section.title}</p>
        {section.description ? (
          <p className="text-content-muted mt-1 text-sm leading-relaxed">{section.description}</p>
        ) : null}
      </div>

      <span className="text-content-muted shrink-0 text-sm tabular-nums">
        {section.durationSec ? formatDuration(section.durationSec) : '—'}
      </span>
    </div>
  )
}
