import { parseCatalogFilters, parseSearchQuery, songStrings } from '@/modules/songs'
import type { RawSearchParams } from '@/modules/songs'
import { getCatalogFacets, getCatalogPage, getSearchSuggestions } from '@/modules/songs/service'
import { routes } from '@/shared/routes'
import { EmptyState, LinkButton } from '@/ui'

import { PageIntro } from '../../_components/page-intro'
import { getContentViewer } from '../../_lib/viewer'

import { CatalogPagination, CatalogPresets } from './_components/catalog-nav'
import { CatalogToolbar } from './_components/catalog-toolbar'
import { FilterPanel } from './_components/filter-panel'
import { SearchEmpty } from './_components/search-empty'
import { SongCardItem } from './_components/song-card'

export const metadata = { title: 'Разборы' }

/**
 * Каталог разборов.
 *
 * Собирается целиком на сервере. Фильтры живут в адресной строке
 * и применяются ссылками, поэтому страница работает без единой строки
 * кода в браузере — кроме поиска и выдвижной панели фильтров
 * на телефоне.
 *
 * Черновики попадают в список только тем, у кого есть право их видеть:
 * решение принимает сервис, страница о нём не знает и знать не должна.
 */
export default async function SongsCatalogPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  const viewer = await getContentViewer('songs.view_drafts')
  if (!viewer) return null

  const filters = parseCatalogFilters(await searchParams)

  const [page, facets] = await Promise.all([
    getCatalogPage(viewer, filters),
    getCatalogFacets(viewer),
  ])

  // Подсказки стоят отдельного запроса, поэтому спрашиваются только
  // тогда, когда их некому заменить: поиск был и не дал ничего
  const suggestions =
    filters.query && page.total === 0 ? await getSearchSuggestions(viewer, filters.query) : []

  // Слова для подсветки берутся из того же разбора запроса, что и сам
  // поиск: подсветить не то, что искалось, — хуже, чем не подсветить
  const terms = parseSearchQuery(filters.query).terms

  const filterPanel = <FilterPanel filters={filters} facets={facets} />

  return (
    <>
      <PageIntro title={songStrings.catalog.title} description={songStrings.catalog.description} />

      <CatalogPresets filters={filters} />

      <CatalogToolbar filters={filters} total={page.total} filterPanel={filterPanel} />

      <div className="flex gap-8">
        {/* Боковая панель только на широком экране: на телефоне те же
            фильтры открываются кнопкой в строке над каталогом */}
        <aside className="hidden w-56 shrink-0 lg:block">{filterPanel}</aside>

        <div className="min-w-0 flex-1">
          {page.items.length === 0 ? (
            filters.query ? (
              <SearchEmpty query={filters.query} suggestions={suggestions} />
            ) : (
              <CatalogEmpty hasFilters={page.total === 0 && hasAnyFilter(filters)} />
            )
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">
              {page.items.map((song) => (
                <SongCardItem key={song.id} song={song} terms={terms} />
              ))}
            </div>
          )}

          <CatalogPagination filters={filters} page={page.page} pageCount={page.pageCount} />
        </div>
      </div>
    </>
  )
}

function hasAnyFilter(filters: ReturnType<typeof parseCatalogFilters>): boolean {
  return (
    filters.query !== null ||
    filters.levels.length > 0 ||
    filters.tunings.length > 0 ||
    filters.tags.length > 0 ||
    filters.curatorId !== null ||
    filters.maxMinutes !== null
  )
}

/**
 * Пустой список.
 *
 * Две разные пустоты, и путать их нельзя: «ничего не нашлось по фильтрам»
 * лечится сбросом фильтров, «разборов ещё нет» — нет. Одинаковое
 * сообщение на оба случая заставило бы человека искать несуществующую
 * кнопку.
 */
function CatalogEmpty({ hasFilters }: { hasFilters: boolean }) {
  if (hasFilters) {
    return (
      <EmptyState
        title={songStrings.catalog.empty}
        description={songStrings.catalog.emptyHint}
        action={
          <LinkButton href={routes.app.learn.songs()} variant="secondary">
            {songStrings.catalog.reset}
          </LinkButton>
        }
      />
    )
  }

  return (
    <EmptyState
      title={songStrings.catalog.emptyCatalog}
      description={songStrings.catalog.emptyCatalogHint}
    />
  )
}
