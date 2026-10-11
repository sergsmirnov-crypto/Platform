import { routes } from '@/shared/routes'
import { PillLink } from '@/ui'

/**
 * Фильтры списка разборов.
 *
 * Ссылками, а не переключателями: состояние живёт в адресе, поэтому
 * «покажи мне все черновики» — это ссылка, которую куратор отправляет
 * коллеге, а кнопка «назад» работает сама собой.
 *
 * Фильтров ровно три, и это не экономия. Куратору нужно ответить
 * на три вопроса: что не доделано, что моё, где вот эта конкретная песня.
 * Всё остальное — украшение, за которое платят вниманием.
 */

type ManageFiltersProps = {
  status: string | null
  onlyMine: boolean
}

const STATUS_FILTERS = [
  { value: null, label: 'Все' },
  { value: 'draft', label: 'Черновики' },
  { value: 'published', label: 'Опубликованные' },
  { value: 'archived', label: 'Архив' },
] as const

export function ManageFilters({ status, onlyMine }: ManageFiltersProps) {
  const build = (next: { status?: string | null; mine?: boolean }): string => {
    const params = new URLSearchParams()
    const nextStatus = next.status === undefined ? status : next.status
    const nextMine = next.mine === undefined ? onlyMine : next.mine

    if (nextStatus) params.set('status', nextStatus)
    if (nextMine) params.set('mine', '1')

    const query = params.toString()

    return query ? `${routes.app.manage.songs()}?${query}` : routes.app.manage.songs()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {STATUS_FILTERS.map((filter) => (
        <PillLink
          key={filter.label}
          href={build({ status: filter.value })}
          active={status === filter.value || (filter.value === null && !status)}
        >
          {filter.label}
        </PillLink>
      ))}

      <span aria-hidden className="text-content-subtle px-1">
        ·
      </span>

      <PillLink href={build({ mine: !onlyMine })} active={onlyMine}>
        Мои
      </PillLink>
    </div>
  )
}
