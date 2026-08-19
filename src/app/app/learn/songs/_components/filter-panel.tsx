import { buildCatalogQuery, LEVELS, songStrings, TUNINGS } from '@/modules/songs'
import type { CatalogFilters } from '@/modules/songs'
import type { CatalogFacets } from '@/modules/songs/repository'
import { routes } from '@/shared/routes'
import { PillLink } from '@/ui'

/**
 * Фильтры каталога.
 *
 * ─────────────────────────────────────────────────────────────────
 * ФИЛЬТРЫ — ЭТО ССЫЛКИ, А НЕ ГАЛОЧКИ
 *
 * Каждый переключатель — обычная ссылка на тот же каталог с другим
 * набором параметров. Из этого следует всё сразу и бесплатно:
 * работающая кнопка «назад», возможность отправить товарищу ссылку
 * на «фингерстайл в DADGAD», отрисовка сразу на сервере без мигания
 * пустым списком и работа при выключенном JavaScript.
 *
 * Расплата — переход страницы на каждое нажатие. При двадцати четырёх
 * карточках, собираемых на сервере, это незаметно.
 * ─────────────────────────────────────────────────────────────────
 *
 * Компонент серверный: он ничего не хранит, только считает адреса.
 */

type FilterPanelProps = {
  filters: CatalogFilters
  facets: CatalogFacets
}

/** Адрес каталога с добавленным или снятым значением фильтра */
function toggleHref(
  filters: CatalogFilters,
  key: 'levels' | 'tunings' | 'tags',
  value: string,
): string {
  const current = filters[key] as string[]
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value]

  // Любое изменение фильтра возвращает на первую страницу: остаться
  // на седьмой при трёх найденных — это пустой экран без объяснения
  return `${routes.app.learn.songs()}${buildCatalogQuery({ ...filters, [key]: next, page: 1 })}`
}

function singleHref(filters: CatalogFilters, curatorId: string | null): string {
  const next = filters.curatorId === curatorId ? null : curatorId

  return `${routes.app.learn.songs()}${buildCatalogQuery({ ...filters, curatorId: next, page: 1 })}`
}

function FilterChip({
  href,
  active,
  children,
  count,
}: {
  href: string
  active: boolean
  children: React.ReactNode
  count?: number
}) {
  return (
    <PillLink href={href} active={active}>
      {children}
      {count !== undefined ? <span className="text-xs opacity-60">{count}</span> : null}
    </PillLink>
  )
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-content-subtle mb-2 text-xs font-semibold tracking-wide uppercase">
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

export function FilterPanel({ filters, facets }: FilterPanelProps) {
  return (
    <div>
      <FilterGroup title={songStrings.filters.level}>
        {LEVELS.map((level) => (
          <FilterChip
            key={level.value}
            href={toggleHref(filters, 'levels', level.value)}
            active={filters.levels.includes(level.value)}
          >
            {level.label}
          </FilterChip>
        ))}
      </FilterGroup>

      <FilterGroup title={songStrings.filters.tuning}>
        {TUNINGS.map((tuning) => (
          <FilterChip
            key={tuning.value}
            href={toggleHref(filters, 'tunings', tuning.value)}
            active={filters.tunings.includes(tuning.value)}
          >
            {tuning.label}
          </FilterChip>
        ))}
      </FilterGroup>

      {facets.genres.length > 0 ? (
        <FilterGroup title={songStrings.filters.genre}>
          {facets.genres.map((genre) => (
            <FilterChip
              key={genre.slug}
              href={toggleHref(filters, 'tags', genre.slug)}
              active={filters.tags.includes(genre.slug)}
              count={genre.count}
            >
              {genre.name}
            </FilterChip>
          ))}
        </FilterGroup>
      ) : null}

      {facets.techniques.length > 0 ? (
        <FilterGroup title={songStrings.filters.technique}>
          {facets.techniques.map((technique) => (
            <FilterChip
              key={technique.slug}
              href={toggleHref(filters, 'tags', technique.slug)}
              active={filters.tags.includes(technique.slug)}
              count={technique.count}
            >
              {technique.name}
            </FilterChip>
          ))}
        </FilterGroup>
      ) : null}

      {facets.curators.length > 1 ? (
        <FilterGroup title={songStrings.filters.curator}>
          {facets.curators.map((curator) => (
            <FilterChip
              key={curator.id}
              href={singleHref(filters, curator.id)}
              active={filters.curatorId === curator.id}
              count={curator.count}
            >
              {curator.displayName}
            </FilterChip>
          ))}
        </FilterGroup>
      ) : null}
    </div>
  )
}
