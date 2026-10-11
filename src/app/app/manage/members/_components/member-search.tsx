'use client'

import { Search, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { buildMemberQuery } from '@/modules/identity/directory-filters'
import type { MemberFilters } from '@/modules/identity/directory-filters'
import { directoryStrings } from '@/modules/identity/directory-strings'
import { routes } from '@/shared/routes'
import { Input } from '@/ui'

/**
 * Поиск по участникам.
 *
 * Единственная часть экрана, которой нужен браузер. Запрос живёт
 * в адресе — как и весь остальной отбор.
 *
 * Задержка та же, что в каталоге разборов, архиве эфиров и визитках
 * участников: 350 мс. Одно значение на всю платформу, потому что разные
 * задержки на разных экранах ощущаются как разная скорость работы сайта.
 */

const SEARCH_DELAY_MS = 350

export function MemberSearch({ filters, total }: { filters: MemberFilters; total: number }) {
  return <MemberSearchInner key={filters.query ?? ''} filters={filters} total={total} />
}

function MemberSearchInner({ filters, total }: { filters: MemberFilters; total: number }) {
  const router = useRouter()
  const [value, setValue] = useState(filters.query ?? '')

  useEffect(() => {
    if (value === (filters.query ?? '')) return

    const timer = setTimeout(() => {
      // Новый запрос возвращает на первую страницу: остаться на третьей
      // с другим запросом — верный способ увидеть пустой экран
      const query = buildMemberQuery({ ...filters, query: value || null, page: 1 })

      router.replace(`${routes.app.manage.members()}${query}`)
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
          placeholder={directoryStrings.search}
          aria-label={directoryStrings.search}
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
        {directoryStrings.found(total)}
      </p>
    </div>
  )
}
