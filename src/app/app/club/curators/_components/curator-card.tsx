import Link from 'next/link'

import { clubStrings } from '@/modules/club'
import type { CuratorCard } from '@/modules/club'
import { routes } from '@/shared/routes'
import { Avatar, Badge } from '@/ui'

/**
 * Карточка куратора в списке.
 *
 * Показывает ровно то, что помогает выбрать, к кому идти: лицо, имя,
 * одна строка о том, чему учит, и метки техник. Стаж и город — мелким:
 * они любопытны, но выбор определяет не они.
 *
 * Скрытая карточка видна только тем, кто правит кураторов, и помечена
 * явно — ровно как черновик разбора в каталоге.
 */
export function CuratorCardItem({ curator }: { curator: CuratorCard }) {
  return (
    <Link
      href={routes.app.club.curator(curator.slug)}
      className="group border-border bg-surface-raised hover:border-border-strong focus-visible:outline-focus-ring block rounded-xl border p-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <div className="flex items-center gap-4">
        <Avatar src={curator.avatarUrl} alt={curator.displayName} size="md" />

        <div className="min-w-0 flex-1">
          <p className="group-hover:text-accent-hover font-display truncate text-lg font-bold transition-colors">
            {curator.displayName}
          </p>

          {curator.headline ? (
            <p className="text-content-muted truncate text-sm">{curator.headline}</p>
          ) : null}

          <p className="text-content-subtle mt-1 truncate text-xs">
            {[
              curator.city,
              curator.teachingYears ? clubStrings.curators.experience(curator.teachingYears) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>

        {!curator.isPublic ? (
          <Badge variant="draft" size="sm">
            {clubStrings.curators.hidden}
          </Badge>
        ) : null}
      </div>

      {curator.teaches.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {curator.teaches.slice(0, 4).map((item) => (
            <li key={item}>
              <Badge variant="outline" size="sm">
                {item}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
    </Link>
  )
}
