import { Check } from 'lucide-react'
import Link from 'next/link'

import type { ResumeCard } from '../../../_lib/resume'

/**
 * Недавнее: то, к чему можно вернуться.
 *
 * Порядок задаёт прогресс — это в точности «последнее, что человек
 * трогал», без пересортировки по видам содержимого. Смешанный список
 * уроков и разборов здесь правильный: человек занимается и тем, и другим
 * в один вечер, и разделение на две колонки заставило бы его искать.
 */
export function RecentList({ cards }: { cards: ResumeCard[] }) {
  return (
    <ul className="space-y-2">
      {cards.map((card) => (
        <li key={card.href}>
          <Link
            href={card.href}
            className="border-border hover:border-border-strong hover:bg-surface-hover flex items-center gap-4 rounded-xl border p-4 transition-colors"
          >
            <span className="min-w-0 flex-1">
              <span className="text-content-muted block text-xs">
                {card.kind === 'lesson' ? 'Урок курса' : 'Разбор песни'}
              </span>
              <span className="block truncate font-medium">{card.title}</span>
              <span className="text-content-muted block truncate text-sm">{card.subtitle}</span>
            </span>

            {card.completed ? (
              <span className="bg-accent text-on-accent flex size-6 shrink-0 items-center justify-center rounded-full">
                <Check size={14} aria-hidden />
                <span className="sr-only">Пройдено</span>
              </span>
            ) : (
              <span className="text-content-muted shrink-0 text-sm tabular-nums">
                {card.percent}%
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}
