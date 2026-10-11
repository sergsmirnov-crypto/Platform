import Link from 'next/link'

import type { OverviewCounter } from '../../_lib/manage-overview'

/**
 * Самочувствие раздела в числах.
 *
 * Ноль не прячется и не подсвечивается: «за неделю опубликовано 0
 * разборов» — самое полезное число на этом экране, и красным его красить
 * не надо. Клуб живёт неровно, неделя без публикаций — это норма,
 * а не авария; человеку достаточно увидеть цифру, чтобы сделать вывод.
 */
export function OverviewCounters({ counters }: { counters: OverviewCounter[] }) {
  if (counters.length === 0) return null

  return (
    <section className="mt-10">
      <h2 className="font-display mb-3 text-lg font-bold">За неделю</h2>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {counters.map((counter) => (
          <div
            key={counter.label}
            className="border-border rounded-lg border px-4 py-3 has-[a:hover]:border-current"
          >
            <dt className="text-content-muted text-xs">
              {counter.href ? (
                <Link href={counter.href} className="hover:text-content">
                  {counter.label}
                </Link>
              ) : (
                counter.label
              )}
            </dt>
            <dd className="font-display mt-1 text-2xl font-bold tabular-nums">{counter.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
