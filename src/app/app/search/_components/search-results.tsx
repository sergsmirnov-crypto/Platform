import Link from 'next/link'

import type { SearchGroup } from '../../_lib/search'

/**
 * Результаты, сгруппированные по разделам.
 *
 * Кода в браузере нет: каждый результат — обычная ссылка. Поиск,
 * который нельзя открыть в новой вкладке или отправить другому,
 * ощущается недоделанным.
 */
export function SearchResults({ groups }: { groups: SearchGroup[] }) {
  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.key}>
          <h2 className="text-content-muted mb-3 text-xs tracking-wide uppercase">{group.title}</h2>

          <ul className="border-border divide-border divide-y overflow-hidden rounded-xl border">
            {group.hits.map((hit) => (
              <li key={hit.href}>
                <Link
                  href={hit.href}
                  className="hover:bg-surface-hover flex flex-col p-4 transition-colors"
                >
                  <span className="font-medium">{hit.title}</span>
                  {hit.subtitle ? (
                    <span className="text-content-muted text-sm">{hit.subtitle}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
