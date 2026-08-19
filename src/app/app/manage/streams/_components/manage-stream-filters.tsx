import { streamStrings } from '@/modules/streams'
import { routes } from '@/shared/routes'
import { PillLink } from '@/ui'

/**
 * Фильтры списка эфиров.
 *
 * Ссылками, а не переключателями: состояние живёт в адресе, поэтому
 * «покажи мне неопубликованные» — это ссылка, которую куратор
 * отправляет коллеге, а кнопка «назад» работает сама собой.
 *
 * Отбор идёт по этапу жизни, а не по статусу публикации, — и это
 * не то же самое, что у разборов. У разбора вопрос «что не доделано»
 * решается статусом; у эфира — этапом: «идёт», «запись» и «скоро»
 * требуют от куратора совершенно разного.
 */

type ManageStreamFiltersProps = {
  state: string | null
  onlyMine: boolean
}

const STATE_FILTERS = [
  { value: null, label: streamStrings.manage.all },
  { value: 'scheduled', label: streamStrings.manage.state.scheduled },
  { value: 'live', label: streamStrings.manage.state.live },
  { value: 'recorded', label: streamStrings.manage.state.recorded },
  { value: 'cancelled', label: streamStrings.manage.state.cancelled },
] as const

export function ManageStreamFilters({ state, onlyMine }: ManageStreamFiltersProps) {
  const build = (next: { state?: string | null; mine?: boolean }): string => {
    const params = new URLSearchParams()
    const nextState = next.state === undefined ? state : next.state
    const nextMine = next.mine === undefined ? onlyMine : next.mine

    if (nextState) params.set('state', nextState)
    if (nextMine) params.set('mine', '1')

    const query = params.toString()

    return query ? `${routes.app.manage.streams()}?${query}` : routes.app.manage.streams()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {STATE_FILTERS.map((filter) => (
        <PillLink
          key={filter.label}
          href={build({ state: filter.value })}
          active={state === filter.value || (filter.value === null && !state)}
        >
          {filter.label}
        </PillLink>
      ))}

      <span aria-hidden className="text-content-subtle px-1">
        ·
      </span>

      <PillLink href={build({ mine: !onlyMine })} active={onlyMine}>
        {streamStrings.manage.onlyMine}
      </PillLink>
    </div>
  )
}
