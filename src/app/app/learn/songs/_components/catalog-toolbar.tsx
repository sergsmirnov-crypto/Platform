'use client'

import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { buildCatalogQuery, songStrings, sortOptionsFor } from '@/modules/songs'
import type { CatalogFilters, SortOption } from '@/modules/songs'
import { routes } from '@/shared/routes'
import { Button, Dialog, Input } from '@/ui'

/**
 * Строка над каталогом: поиск, порядок, кнопка фильтров на телефоне.
 *
 * Единственная часть каталога, которой нужен браузер. Всё остальное —
 * ссылки и серверная отрисовка; здесь же требуется ввод с задержкой
 * и выдвижная панель, а это без кода в браузере не сделать.
 *
 * Задержка перед поиском — 350 мс. Меньше — и запрос уходит на каждую
 * букву; больше — и человек успевает решить, что поиск не работает.
 */

const SEARCH_DELAY_MS = 350

type CatalogToolbarProps = {
  filters: CatalogFilters
  total: number
  /** Панель фильтров: на телефоне показывается в выдвижном окне */
  filterPanel: React.ReactNode
}

export function CatalogToolbar(props: CatalogToolbarProps) {
  // Смена поискового запроса в адресе пересоздаёт строку целиком,
  // и поле получает новое начальное значение без эффекта синхронизации
  return <CatalogToolbarInner key={props.filters.query ?? ''} {...props} />
}

function CatalogToolbarInner({ filters, total, filterPanel }: CatalogToolbarProps) {
  const router = useRouter()
  const [filtersOpen, setFiltersOpen] = useState(false)

  /*
   * Поле поиска пересоздаётся при смене адреса — приём с ключом.
   *
   * Адрес меняется и не отсюда: нажатием «назад», сбросом фильтров,
   * выбором подборки. Синхронизировать поле с адресом внутри эффекта
   * было бы лишней отрисовкой и лишним поводом ошибиться; ключ решает
   * то же самое одной строкой ниже, в разметке.
   */
  const [query, setQuery] = useState(filters.query ?? '')

  useEffect(() => {
    if (query === (filters.query ?? '')) return

    const timer = setTimeout(() => {
      const next = buildCatalogQuery({ ...filters, query: query || null, page: 1 })
      // replace, а не push: иначе каждая буква оставляла бы след в истории,
      // и кнопка «назад» отматывала бы набранное по одному символу
      router.replace(`${routes.app.learn.songs()}${next}`)
    }, SEARCH_DELAY_MS)

    return () => clearTimeout(timer)
  }, [query, filters, router])

  function changeSort(sort: SortOption) {
    router.push(`${routes.app.learn.songs()}${buildCatalogQuery({ ...filters, sort, page: 1 })}`)
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <div className="relative min-w-48 flex-1">
        <Search
          size={18}
          aria-hidden
          className="text-content-subtle pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={songStrings.catalog.searchPlaceholder}
          aria-label={songStrings.catalog.searchPlaceholder}
          className="pl-10"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Очистить поиск"
            className="text-content-subtle hover:text-content absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full"
          >
            <X size={16} aria-hidden />
          </button>
        ) : null}
      </div>

      <label className="flex items-center gap-2">
        <span className="sr-only">{songStrings.filters.sort}</span>
        <select
          value={filters.sort}
          onChange={(event) => changeSort(event.target.value as SortOption)}
          className="border-border bg-surface text-content h-11 rounded-full border px-4 text-sm"
        >
          {/* Пункт «по совпадению» появляется только при наличии запроса:
              сортировать по совпадению в пустом каталоге не с чем */}
          {sortOptionsFor(filters.query !== null).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {/* На широком экране фильтры стоят сбоку и всегда видны;
          на телефоне для них нет места, поэтому кнопка и выдвижное окно */}
      <Button
        variant="secondary"
        size="sm"
        className="lg:hidden"
        onClick={() => setFiltersOpen(true)}
      >
        <SlidersHorizontal size={16} aria-hidden />
        Фильтры
      </Button>

      <p className="text-content-muted w-full text-sm lg:w-auto">
        {songStrings.catalog.found(total)}
      </p>

      <Dialog
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Фильтры"
        footer={<Button onClick={() => setFiltersOpen(false)}>Показать {total}</Button>}
      >
        {filterPanel}
      </Dialog>
    </div>
  )
}
