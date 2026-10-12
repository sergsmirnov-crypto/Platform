import { reactionStrings } from '@/modules/reactions'
import type { ReactionSummary } from '@/modules/reactions'
import { ReactionIcon } from '@/ui'

/**
 * Реакции в карточке ленты — только посмотреть.
 *
 * Карточка целиком — ссылка на пост, а кнопка внутри ссылки — ошибка
 * разметки: экранный диктор и клавиатура не поймут, что нажимается.
 * Поэтому здесь значки со счётчиками, а ставят реакцию на странице поста.
 *
 * Компонент сервера: в браузер не уходит ни строчки кода.
 */

/** Сколько разных реакций показать в карточке, остальное — общим числом */
const MAX_ICONS = 4

export function ReactionPreview({ summary }: { summary: ReactionSummary }) {
  if (summary.total === 0) return null

  const shown = [...summary.counts].sort((a, b) => b.count - a.count).slice(0, MAX_ICONS)

  return (
    <span
      className="text-content-muted inline-flex items-center gap-1.5 text-sm tabular-nums"
      aria-label={shown
        .map((item) =>
          reactionStrings.countLabel(reactionStrings.labels[item.key], item.count, false),
        )
        .join(', ')}
    >
      <span className="flex -space-x-1.5" aria-hidden>
        {shown.map((item) => (
          <ReactionIcon
            key={item.key}
            name={item.key}
            size={20}
            className="ring-surface rounded-full ring-2"
          />
        ))}
      </span>
      <span aria-hidden>{summary.total}</span>
    </span>
  )
}
