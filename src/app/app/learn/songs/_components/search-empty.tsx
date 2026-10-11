import Link from 'next/link'

import { songStrings } from '@/modules/songs'
import type { SongSuggestion } from '@/modules/songs'
import { routes } from '@/shared/routes'
import { EmptyState, LinkButton } from '@/ui'

/**
 * Поиск не нашёл ничего.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПУСТОТА С ДЕЙСТВИЕМ, А НЕ СООБЩЕНИЕ О НЕУДАЧЕ
 *
 * «Ничего не найдено» — тупик: человек перечитывает свой запрос
 * и не понимает, ошибся он или разбора действительно нет. Поэтому,
 * когда база находит похожие названия, они показываются сразу.
 *
 * Похожесть считается по триграммам и переживает опечатку в одну-две
 * буквы: «металика» приводит к «Metallica». Это единственное место
 * в поиске, где мы предлагаем человеку исправление, а не пытаемся
 * угадать молча.
 * ─────────────────────────────────────────────────────────────────
 */

type SearchEmptyProps = {
  query: string
  suggestions: SongSuggestion[]
}

export function SearchEmpty({ query, suggestions }: SearchEmptyProps) {
  // Когда есть подсказки, объяснение «проверьте написание» лишнее:
  // исправление уже показано, читать совет незачем
  if (suggestions.length > 0) {
    return (
      <EmptyState
        title={songStrings.catalog.notFound(query)}
        action={<Suggestions suggestions={suggestions} />}
      />
    )
  }

  return (
    <EmptyState
      title={songStrings.catalog.notFound(query)}
      description={songStrings.catalog.notFoundHint}
      action={
        <LinkButton href={routes.app.learn.songs()} variant="secondary">
          {songStrings.catalog.reset}
        </LinkButton>
      }
    />
  )
}

/**
 * Ссылки, а не кнопки «искать это вместо того».
 *
 * Человек уже понял, какую песню он ищет, — второй поиск ему не нужен,
 * нужен сам разбор. Ссылка ведёт прямо на страницу песни и экономит шаг.
 */
function Suggestions({ suggestions }: { suggestions: SongSuggestion[] }) {
  return (
    <div>
      <p className="text-content-muted mb-3 text-sm">{songStrings.catalog.didYouMean}</p>

      <ul className="flex flex-col items-center gap-2">
        {suggestions.map((suggestion) => (
          <li key={suggestion.slug}>
            <Link
              href={routes.app.learn.song(suggestion.slug)}
              className="hover:text-accent-hover font-medium underline underline-offset-4 transition-colors"
            >
              {suggestion.artist} — {suggestion.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
