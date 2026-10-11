import { getAuditLogPage, hasActiveLogFilters, logStrings, parseLogFilters } from '@/modules/audit'
import type { AuditEntry } from '@/modules/audit'
import { EmptyState } from '@/ui'

import { PageIntro } from '../../_components/page-intro'
import { requireManagePermission } from '../../_lib/guards'

import { LogDayGroup } from './_components/log-entry'
import { LogFiltersBar, LogPagination, LogScopeNote } from './_components/log-filters'

export const metadata = { title: 'Журнал действий' }

/**
 * Журнал действий.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЭКРАН СУЩЕСТВУЕТ РАДИ ОДНОГО ВОПРОСА
 *
 * «Куда делся разбор Nothing Else Matters». Он должен решаться
 * за десять секунд вместо часа переписки (PRD v0.3 §6) — и всё
 * устройство экрана подчинено этому.
 *
 * Поэтому здесь нет ни сводок, ни графиков активности команды, ни
 * «лучших кураторов недели». Журнал — не панель наблюдения за людьми,
 * а инструмент для разбора конкретного случая. Трое кураторов, которые
 * знают, что их действия считают, начинают работать хуже; трое
 * кураторов, у которых есть ответ на вопрос «а куда делось», — лучше.
 *
 * Два нажатия делают почти всю работу: по имени — «что делал этот
 * человек», по названию — «что происходило с этим объектом».
 * ─────────────────────────────────────────────────────────────────
 */

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AuditLogPage({ searchParams }: Props) {
  const viewer = await requireManagePermission('audit.view')

  const filters = parseLogFilters(await searchParams)
  const { entries, total, page, pageCount, keptSince } = await getAuditLogPage(
    viewer.userId,
    filters,
  )

  return (
    <>
      <PageIntro title={logStrings.title} description={logStrings.description} />

      <LogFiltersBar filters={filters} total={total} />
      <LogScopeNote filters={filters} entries={entries} />

      {entries.length === 0 ? (
        <EmptyState
          className="border-border mt-8 rounded-lg border border-dashed"
          title={hasActiveLogFilters(filters) ? logStrings.empty.filtered : logStrings.empty.none}
          description={
            hasActiveLogFilters(filters) ? logStrings.empty.filteredHint : logStrings.empty.noneHint
          }
        />
      ) : (
        <div className="mt-6 space-y-8">
          {groupByDay(entries).map(([day, dayEntries]) => (
            <LogDayGroup key={day} day={day} entries={dayEntries} filters={filters} />
          ))}
        </div>
      )}

      <LogPagination filters={filters} page={page} pageCount={pageCount} />

      {/* Срок хранения показан внизу списка, а не сверху: он объясняет,
          почему поиск ничего не нашёл, — и нужен ровно тогда, когда
          человек долистал до конца и не нашёл искомого */}
      <p className="text-content-subtle mt-8 text-center text-xs">
        {logStrings.retention(formatDay(keptSince))}
      </p>
    </>
  )
}

/**
 * Раскладывает записи по дням.
 *
 * Дата в каждой строке превратила бы список в столбец повторяющихся
 * чисел. Заголовок дня и время в строке читаются как обычная лента
 * событий — тем более что почти всё, что ищут, случилось «вчера»
 * или «на прошлой неделе», а не в конкретное число.
 */
function groupByDay(entries: AuditEntry[]): [string, AuditEntry[]][] {
  const groups = new Map<string, AuditEntry[]>()

  for (const entry of entries) {
    const day = entry.at.toISOString().slice(0, 10)
    const list = groups.get(day) ?? []

    list.push(entry)
    groups.set(day, list)
  }

  return [...groups.entries()]
}

function formatDay(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}
