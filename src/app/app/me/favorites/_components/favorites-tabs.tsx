import { countByEntity, FAVORITE_TABS, libraryStrings } from '@/modules/library'
import type { FavoriteRef, FavoriteTab } from '@/modules/library'
import { routes } from '@/shared/routes'
import { PillLink } from '@/ui'

/**
 * Вкладки по видам содержимого.
 *
 * Ссылки, а не переключатель с обработчиком: выбранная вкладка живёт
 * в адресной строке. Из этого бесплатно получается работающая кнопка
 * «назад» и сохранение вкладки при перезагрузке — то же правило, что
 * у фильтров каталога.
 *
 * Пустые вкладки показываются вместе с нулём, а не прячутся: исчезающие
 * вкладки заставляют человека гадать, куда делся раздел, который он
 * видел вчера.
 */

type FavoritesTabsProps = {
  rows: FavoriteRef[]
  current: FavoriteTab
}

export function FavoritesTabs({ rows, current }: FavoritesTabsProps) {
  const counts = countByEntity(rows)

  return (
    <nav aria-label={libraryStrings.title} className="mb-6 flex flex-wrap gap-2">
      {FAVORITE_TABS.map((tab) => {
        const total = tab === 'all' ? rows.length : counts[tab]

        return (
          <PillLink
            key={tab}
            // Вкладка по умолчанию — без параметра в адресе: у страницы
            // должен быть один канонический адрес, а не два одинаковых
            href={tab === 'all' ? routes.app.me.favorites() : `${routes.app.me.favorites()}?tab=${tab}`} // prettier-ignore
            active={tab === current}
            scroll={false}
          >
            {libraryStrings.tabs[tab]}
            <span className="text-content-muted tabular-nums">{total}</span>
          </PillLink>
        )
      })}
    </nav>
  )
}
