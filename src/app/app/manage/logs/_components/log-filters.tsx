import { buildLogQuery, LOG_GROUPS, LOG_PERIODS, logStrings } from '@/modules/audit'
import type { AuditEntry, LogFilters } from '@/modules/audit'
import { routes } from '@/shared/routes'
import { PillLink } from '@/ui'

import { LogSearch } from './log-search'

/**
 * Отбор в журнале.
 *
 * Ссылками, а не переключателями: отбор в журнале почти всегда делается
 * ради чужого вопроса, и ссылка отвечает на него целиком. Нажатие
 * на выбранный раздел снимает его — иначе выбраться из «Разборов»
 * можно было бы только через «Все действия», и это приходилось бы
 * угадывать.
 */

export function logHref(filters: LogFilters, next: Partial<LogFilters>): string {
  // Любое изменение отбора возвращает на первую страницу: оставшаяся
  // четвёртая страница почти всегда оказывается пустой
  return `${routes.app.manage.logs()}${buildLogQuery({ ...filters, ...next, page: 1 })}`
}

export function LogFiltersBar({ filters, total }: { filters: LogFilters; total: number }) {
  return (
    <div className="space-y-4">
      <LogSearch filters={filters} total={total} />

      <div className="flex flex-wrap items-center gap-2">
        <PillLink href={logHref(filters, { group: null })} active={filters.group === null}>
          {logStrings.filters.allGroups}
        </PillLink>

        {LOG_GROUPS.map((group) => (
          <PillLink
            key={group}
            href={logHref(filters, { group: filters.group === group ? null : group })}
            active={filters.group === group}
          >
            {logStrings.filters.groups[group]}
          </PillLink>
        ))}
      </div>

      {/* Срок — отдельной строкой: это не отбор по смыслу, а глубина,
          на которую человек готов смотреть */}
      <div className="flex flex-wrap items-center gap-2">
        {LOG_PERIODS.map((period) => (
          <PillLink
            key={period}
            href={logHref(filters, { period })}
            current={filters.period === period}
            className="text-xs"
          >
            {logStrings.filters.periods[period]}
          </PillLink>
        ))}
      </div>
    </div>
  )
}

/**
 * Плашка «показана история одного объекта».
 *
 * Отбор по человеку или объекту включается нажатием внутри строки,
 * а не кнопкой сверху. Без объяснения это выглядит как «журнал вдруг
 * опустел»: человек не помнит, что именно он нажал полсекунды назад.
 *
 * Название берётся из первой записи выборки: в журнале имя объекта
 * известно только по его же записям.
 */
export function LogScopeNote({ filters, entries }: { filters: LogFilters; entries: AuditEntry[] }) {
  if (!filters.actorId && !filters.entity) return null

  const first = entries[0]
  const subject = filters.actorId ? (first?.actor?.name ?? null) : (first?.entity?.title ?? null)

  const note = filters.actorId ? logStrings.scoped.actor : logStrings.scoped.entity

  return (
    <div className="border-border bg-surface-sunken mt-4 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3">
      <p className="text-sm">
        {note}
        {subject ? <span className="font-medium"> · {subject}</span> : null}
      </p>

      <PillLink
        href={logHref(filters, { actorId: null, entity: null })}
        className="ml-auto text-xs"
      >
        {logStrings.scoped.clear}
      </PillLink>
    </div>
  )
}

type PaginationProps = {
  filters: LogFilters
  page: number
  pageCount: number
}

/**
 * Переход по страницам.
 *
 * Только «назад», «вперёд» и положение — как в списке участников.
 * Номера страниц в ленте событий бесполезны: никто не помнит, что
 * нужная запись была на четвёртой.
 */
export function LogPagination({ filters, page, pageCount }: PaginationProps) {
  if (pageCount <= 1) return null

  function pageHref(target: number): string {
    return `${routes.app.manage.logs()}${buildLogQuery({ ...filters, page: target })}`
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
