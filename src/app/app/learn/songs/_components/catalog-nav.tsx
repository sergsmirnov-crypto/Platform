import { buildCatalogQuery, CATALOG_PRESETS, isPresetActive } from '@/modules/songs'
import type { CatalogFilters } from '@/modules/songs'
import { routes } from '@/shared/routes'
import { PillLink } from '@/ui'

/**
 * Быстрые подборки и переход по страницам.
 *
 * Оба — ссылки, оба серверные. Подборки отвечают на вопрос, с которым
 * человек приходит на самом деле: не «покажи разборы уровня intermediate
 * в строе DADGAD», а «что мне разобрать сегодня вечером».
 */

export function CatalogPresets({ filters }: { filters: CatalogFilters }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {CATALOG_PRESETS.map((preset) => {
        const active = isPresetActive(preset, filters)

        // Нажатие на выбранную подборку снимает её — иначе выбравшись
        // из «Для новичка» можно только через «Сбросить всё»
        const next = active ? {} : { ...preset.filters, sort: filters.sort, query: filters.query }

        return (
          <PillLink
            key={preset.value}
            href={`${routes.app.learn.songs()}${buildCatalogQuery(next as Partial<CatalogFilters>)}`}
            current={active}
          >
            {preset.label}
          </PillLink>
        )
      })}
    </div>
  )
}

type PaginationProps = {
  filters: CatalogFilters
  page: number
  pageCount: number
}

/**
 * Переход по страницам.
 *
 * Номера показываются только соседние: при сорока страницах полный
 * список номеров занимает больше места, чем сами карточки, и попасть
 * пальцем в нужный невозможно.
 */
export function CatalogPagination({ filters, page, pageCount }: PaginationProps) {
  if (pageCount <= 1) return null

  const numbers = new Set<number>([1, pageCount, page - 1, page, page + 1])
  const visible = [...numbers]
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((a, b) => a - b)

  function href(target: number): string {
    return `${routes.app.learn.songs()}${buildCatalogQuery({ ...filters, page: target })}`
  }

  return (
    <nav className="mt-10 flex flex-wrap items-center justify-center gap-2" aria-label="Страницы">
      {page > 1 ? (
        <PillLink href={href(page - 1)} rel="prev" size="md">
          Назад
        </PillLink>
      ) : null}

      {visible.map((value, index) => (
        <span key={value} className="flex items-center gap-2">
          {index > 0 && value - (visible[index - 1] ?? 0) > 1 ? (
            <span className="text-content-subtle px-1">…</span>
          ) : null}

          <PillLink
            href={href(value)}
            size="md"
            active={value === page}
            className="min-w-11 justify-center"
          >
            {value}
          </PillLink>
        </span>
      ))}

      {page < pageCount ? (
        <PillLink href={href(page + 1)} rel="next" size="md">
          Вперёд
        </PillLink>
      ) : null}
    </nav>
  )
}
