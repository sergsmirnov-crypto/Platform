import { Suspense } from 'react'

import { parseSearchQuery } from '@/shared/search'
import { EmptyState } from '@/ui'

import { PageIntro } from '../_components/page-intro'
import { findSearchGroups } from '../_lib/search'

import { SearchField } from './_components/search-field'
import { SearchResults } from './_components/search-results'

export const metadata = { title: 'Поиск' }

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Общий поиск по платформе.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗАПРОС ЖИВЁТ В АДРЕСЕ
 *
 * Из этого бесплатно получается работающая кнопка «назад», возможность
 * отправить ссылку на результаты и открыть их в новой вкладке. То же
 * правило, что у фильтров каталога (ARCHITECTURE §11).
 * ─────────────────────────────────────────────────────────────────
 *
 * Три состояния: пусто (человек только зашёл), нашлось, не нашлось.
 * Третье отличается от первого текстом: «ничего не найдено» и «введите
 * запрос» — разные сообщения, и путать их нельзя.
 */
export default async function SearchPage({ searchParams }: Props) {
  const query = await searchParams
  const raw = Array.isArray(query.q) ? query.q[0] : query.q
  const parsed = parseSearchQuery(raw ?? null)

  const groups = parsed.raw ? await findSearchGroups(parsed.raw) : []

  return (
    <>
      <PageIntro title="Поиск" description="Разборы, уроки, эфиры и кураторы" />

      {/* Строка читает адрес, поэтому обёрнута: без этого страница
          не собралась бы заранее */}
      <Suspense fallback={null}>
        <SearchField />
      </Suspense>

      {!parsed.raw ? (
        <EmptyState
          title="Что ищем?"
          description="Название песни, исполнитель, тема эфира или имя куратора"
          className="border-border rounded-lg border border-dashed"
        />
      ) : groups.length > 0 ? (
        <SearchResults groups={groups} />
      ) : (
        <EmptyState
          title="Ничего не нашлось"
          description="Попробуйте короче: по началу слова поиск тоже работает"
          className="border-border rounded-lg border border-dashed"
        />
      )}
    </>
  )
}
