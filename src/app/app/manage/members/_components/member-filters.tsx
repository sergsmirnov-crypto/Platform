import {
  buildMemberQuery,
  directoryStrings,
  MEMBER_ACCESS_FILTERS,
  MEMBER_SORTS,
} from '@/modules/identity'
import type { MemberFilters } from '@/modules/identity'
import { routes } from '@/shared/routes'
import { PillLink } from '@/ui'

/**
 * Отбор в списке участников.
 *
 * Ссылками, а не переключателями: состояние живёт в адресе, поэтому
 * «вот эти трое без подписки» — ссылка, которую можно отправить второму
 * администратору, а кнопка «назад» работает сама собой.
 *
 * Нажатие на выбранный фильтр снимает его. Иначе выбраться из «Без
 * подписки» можно было бы только через «Все», и это приходилось бы
 * угадывать.
 */

function href(filters: MemberFilters, next: Partial<MemberFilters>): string {
  // Любое изменение отбора возвращает на первую страницу: оставшаяся
  // четвёртая страница почти всегда оказывается пустой
  return `${routes.app.manage.members()}${buildMemberQuery({ ...filters, ...next, page: 1 })}`
}

export function MemberFiltersBar({ filters }: { filters: MemberFilters }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <PillLink href={href(filters, { access: null })} active={filters.access === null}>
        {directoryStrings.filters.all}
      </PillLink>

      {MEMBER_ACCESS_FILTERS.map((value) => (
        <PillLink
          key={value}
          href={href(filters, { access: filters.access === value ? null : value })}
          active={filters.access === value}
        >
          {directoryStrings.filters.access[value]}
        </PillLink>
      ))}

      <span aria-hidden className="text-content-subtle px-1">
        ·
      </span>

      <PillLink href={href(filters, { team: !filters.team })} active={filters.team}>
        {directoryStrings.filters.team}
      </PillLink>

      <PillLink href={href(filters, { blocked: !filters.blocked })} active={filters.blocked}>
        {directoryStrings.filters.blocked}
      </PillLink>
    </div>
  )
}

/** Порядок показа. Отдельной строкой: это не отбор, а взгляд на тот же список */
export function MemberSortBar({ filters }: { filters: MemberFilters }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {MEMBER_SORTS.map((value) => (
        <PillLink
          key={value}
          href={href(filters, { sort: value })}
          current={filters.sort === value}
          className="text-xs"
        >
          {directoryStrings.filters.sort[value]}
        </PillLink>
      ))}
    </div>
  )
}

type PaginationProps = {
  filters: MemberFilters
  page: number
  pageCount: number
}

/**
 * Переход по страницам.
 *
 * Только «назад», «вперёд» и положение: номера страниц в списке людей
 * бесполезны — никто не помнит, что Иван был на четвёртой.
 */
export function MemberPagination({ filters, page, pageCount }: PaginationProps) {
  if (pageCount <= 1) return null

  function pageHref(target: number): string {
    return `${routes.app.manage.members()}${buildMemberQuery({ ...filters, page: target })}`
  }

  return (
    <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Страницы">
      {page > 1 ? (
        <PillLink href={pageHref(page - 1)} rel="prev" size="md">
          Назад
        </PillLink>
      ) : null}

      <span className="text-content-muted text-sm tabular-nums">
        {page} из {pageCount}
      </span>

      {page < pageCount ? (
        <PillLink href={pageHref(page + 1)} rel="next" size="md">
          Вперёд
        </PillLink>
      ) : null}
    </nav>
  )
}
