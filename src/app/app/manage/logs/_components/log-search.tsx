'use client'

import { Search, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { buildLogQuery } from '@/modules/audit/log-filters'
import type { LogFilters } from '@/modules/audit/log-filters'
import { logStrings } from '@/modules/audit/log-strings'
import { routes } from '@/shared/routes'
import { Input } from '@/ui'

/**
 * Поиск по журналу.
 *
 * Единственная часть экрана, которой нужен браузер. Ищет по названию
 * объекта и по именам обоих участников события — потому что заранее
 * неизвестно, что человек набрал: «Nothing Else» или «Мария».
 *
 * Задержка та же, что во всех остальных поисках платформы: 350 мс.
 * Одно значение везде, иначе разные экраны ощущаются как сайты
 * разной скорости.
 */

const SEARCH_DELAY_MS = 350

export function LogSearch({ filters, total }: { filters: LogFilters; total: number }) {
  // Ключ сбрасывает внутреннее состояние, когда запрос изменился
  // снаружи — например, при нажатии «Сбросить отбор»
  return <LogSearchInner key={filters.query ?? ''} filters={filters} total={total} />
}

function LogSearchInner({ filters, total }: { filters: LogFilters; total: number }) {
  const router = useRouter()
  const [value, setValue] = useState(filters.query ?? '')

  useEffect(() => {
    if (value === (filters.query ?? '')) return

    const timer = setTimeout(() => {
      const query = buildLogQuery({ ...filters, query: value || null, page: 1 })

      router.replace(`${routes.app.manage.logs()}${query}`)
    }, SEARCH_DELAY_MS)

    return () => clearTimeout(timer)
  }, [value, filters, router])

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-48 flex-1">
        <Search
          size={18}
          aria-hidden
          className="text-content-subtle pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
        />
        <Input
          type="search"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={logStrings.filters.search}
          aria-label={logStrings.filters.search}
          className="pl-10"
        />
        {value ? (
          <button
            type="button"
            onClick={() => setValue('')}
            aria-label="Очистить поиск"
            className="text-content-subtle hover:text-content absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full"
          >
            <X size={16} aria-hidden />
          </button>
        ) : null}
      </div>

      <p className="text-content-muted text-sm whitespace-nowrap">
        {logStrings.filters.found(total)}
      </p>
    </div>
  )
}
