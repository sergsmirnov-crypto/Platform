'use client'

import { Search, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { clubStrings } from '@/modules/club'
import { routes } from '@/shared/routes'
import { Input } from '@/ui'

/**
 * Поиск по участникам.
 *
 * Единственная часть страницы, которой нужен браузер. Запрос живёт
 * в адресе, поэтому ссылку на «всех из Казани» можно отправить,
 * а кнопка «назад» работает сама собой.
 *
 * Задержка та же, что в каталоге разборов и архиве эфиров: 350 мс.
 * Отбор по городу при вводе имени снимается — иначе человек ищет
 * знакомого и не находит его, потому что фильтр остался с прошлого шага.
 */

const SEARCH_DELAY_MS = 350

export function MembersSearch({ query, total }: { query: string | null; total: number }) {
  return <MembersSearchInner key={query ?? ''} query={query} total={total} />
}

function MembersSearchInner({ query, total }: { query: string | null; total: number }) {
  const router = useRouter()
  const [value, setValue] = useState(query ?? '')

  useEffect(() => {
    if (value === (query ?? '')) return

    const timer = setTimeout(() => {
      const search = value ? `?q=${encodeURIComponent(value)}` : ''

      router.replace(`${routes.app.club.members()}${search}`)
    }, SEARCH_DELAY_MS)

    return () => clearTimeout(timer)
  }, [value, query, router])

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
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={clubStrings.members.search}
          aria-label={clubStrings.members.search}
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

      <p className="text-content-muted text-sm">{clubStrings.members.count(total)}</p>
    </div>
  )
}
