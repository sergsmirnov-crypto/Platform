import { buildArchiveQuery } from '@/modules/streams'
import type { ArchiveFilters } from '@/modules/streams'
import { routes } from '@/shared/routes'
import { PillLink } from '@/ui'

/**
 * Переход по страницам архива.
 *
 * Ссылки, а не кнопки: страница живёт в адресе, поэтому «назад»
 * работает сама собой, а ссылку на третью страницу можно отправить.
 *
 * Номера показываются только соседние. При сорока страницах полный
 * список номеров занял бы больше места, чем сами записи, а попасть
 * пальцем в нужный было бы невозможно.
 */

type ArchiveNavProps = {
  filters: ArchiveFilters
  page: number
  pageCount: number
}

export function ArchiveNav({ filters, page, pageCount }: ArchiveNavProps) {
  if (pageCount <= 1) return null

  const numbers = new Set<number>([1, pageCount, page - 1, page, page + 1])
  const visible = [...numbers]
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((a, b) => a - b)

  function href(target: number): string {
    return `${routes.app.streams.index()}${buildArchiveQuery({ ...filters, page: target })}`
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
