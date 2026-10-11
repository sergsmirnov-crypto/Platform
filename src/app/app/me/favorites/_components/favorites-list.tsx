import Link from 'next/link'

import { libraryStrings } from '@/modules/library'

import { FavoriteButton } from '../../../_components/favorite-button'

import type { LibraryCard } from '../../../_lib/library'

/**
 * Список отложенного.
 *
 * Строки, а не сетка обложек. Обложка помогает выбирать среди
 * незнакомого — в каталоге это её работа. Здесь всё уже выбрано самим
 * человеком, и ему нужно узнать своё, а не рассмотреть: строка с
 * названием делает это быстрее и вмещает вдвое больше на экран.
 *
 * Кнопка убирает прямо отсюда, без захода на страницу разбора. Иначе
 * разбор списка превращается в поход по десяти страницам — и его никто
 * не делает, а список растёт, пока не перестаёт быть полезным.
 */

export function FavoritesList({ cards }: { cards: LibraryCard[] }) {
  return (
    <ul className="space-y-2">
      {cards.map((card) => (
        <li
          key={`${card.entityType}:${card.entityId}`}
          className="border-border hover:border-border-strong flex items-center gap-2 rounded-xl border pr-2 transition-colors"
        >
          <Link href={card.href} className="hover:bg-surface-hover min-w-0 flex-1 rounded-l-xl p-4">
            <span className="text-content-muted block text-xs">
              {libraryStrings.kind[card.entityType]}
            </span>
            <span className="block truncate font-medium">{card.title}</span>
            {card.subtitle ? (
              <span className="text-content-muted block truncate text-sm">{card.subtitle}</span>
            ) : null}
          </Link>

          {/* Обновление страницы здесь нужно: убранная карточка обязана
              исчезнуть, иначе список врёт до следующего перехода */}
          <FavoriteButton
            entityType={card.entityType}
            entityId={card.entityId}
            initial
            compact
            refresh
          />
        </li>
      ))}
    </ul>
  )
}
