'use client'

import { Search, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { buildArchiveQuery, streamStrings } from '@/modules/streams'
import type { ArchiveFilters } from '@/modules/streams'
import { routes } from '@/shared/routes'
import { Input } from '@/ui'

/**
 * Строка над архивом: поиск по теме и отбор по куратору.
 *
 * Единственная часть архива, которой нужен браузер: ввод с задержкой
 * и мгновенная реакция списка ссылками не делаются. Всё остальное —
 * страницы, сброс фильтров — обычные ссылки на сервере.
 *
 * Задержка та же, что в каталоге разборов: 350 мс. Меньше — запрос
 * уходит на каждую букву; больше — человек успевает решить, что поиск
 * сломан.
 */

const SEARCH_DELAY_MS = 350

type ArchiveToolbarProps = {
  filters: ArchiveFilters
  total: number
  curators: { id: string; displayName: string; count: number }[]
}

export function ArchiveToolbar(props: ArchiveToolbarProps) {
  // Смена запроса в адресе пересоздаёт строку целиком, и поле получает
  // новое начальное значение без эффекта синхронизации. Тот же приём,
  // что в каталоге разборов
  return <ArchiveToolbarInner key={props.filters.query ?? ''} {...props} />
}

function ArchiveToolbarInner({ filters, total, curators }: ArchiveToolbarProps) {
  const router = useRouter()
  const [query, setQuery] = useState(filters.query ?? '')

  useEffect(() => {
    if (query === (filters.query ?? '')) return

    const timer = setTimeout(() => {
      const next = buildArchiveQuery({ ...filters, query: query || null, page: 1 })

      // replace, а не push: иначе каждая буква оставляла бы след
      // в истории, и «назад» отматывала бы набранное по символу
      router.replace(`${routes.app.streams.index()}${next}`)
    }, SEARCH_DELAY_MS)

    return () => clearTimeout(timer)
  }, [query, filters, router])

  function changeCurator(curatorId: string) {
    const next = buildArchiveQuery({ ...filters, curatorId: curatorId || null, page: 1 })

    router.push(`${routes.app.streams.index()}${next}`)
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
          placeholder={streamStrings.list.searchPlaceholder}
          aria-label={streamStrings.list.searchPlaceholder}
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

      {/* Список кураторов собран из данных: тот, кто ещё не вёл эфиров,
          в отборе не появится, и человек не упрётся в пустую выдачу */}
      {curators.length > 1 ? (
        <label className="flex items-center gap-2">
          <span className="sr-only">{streamStrings.list.allCurators}</span>
          <select
            value={filters.curatorId ?? ''}
            onChange={(event) => changeCurator(event.target.value)}
            className="border-border bg-surface text-content h-11 rounded-full border px-4 text-sm"
          >
            <option value="">{streamStrings.list.allCurators}</option>
            {curators.map((curator) => (
              <option key={curator.id} value={curator.id}>
                {curator.displayName} ({curator.count})
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <p className="text-content-muted w-full text-sm lg:w-auto">
        {streamStrings.list.found(total)}
      </p>
    </div>
  )
}
