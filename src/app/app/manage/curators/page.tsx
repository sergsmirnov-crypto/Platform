import { clubStrings } from '@/modules/club'
import { getCurators } from '@/modules/club/service'
import { routes } from '@/shared/routes'
import { Avatar, Badge, EmptyState, PillLink } from '@/ui'

import { PageIntro } from '../../_components/page-intro'
import { requireManagePermission } from '../../_lib/guards'

import { AddCuratorPanel } from './_components/add-curator-panel'

export const metadata = { title: 'Кураторы: управление' }

/**
 * Экран управления карточками кураторов.
 *
 * ─────────────────────────────────────────────────────────────────
 * СПИСОК ЛЮДЕЙ, А НЕ СПИСОК ЗАПИСЕЙ
 *
 * Здесь три-четыре строки и так будет ещё долго: кураторов в клубе
 * трое. Поэтому ни поиска, ни фильтров, ни постраничной навигации —
 * всё это обслуживало бы список, который целиком помещается на экран.
 *
 * Порядок показа виден числом и правится в карточке. Перетаскивание
 * ради четырёх строк — лишняя работа и лишний код в браузере.
 * ─────────────────────────────────────────────────────────────────
 */
export default async function ManageCuratorsPage() {
  // Право со степенью «все»: свою карточку куратор правит со своей
  // страницы, а этот экран — про чужие
  const viewer = await requireManagePermission('curators.edit')

  const curators = await getCurators({ userId: viewer.userId, canSeeHidden: true })

  return (
    <>
      <PageIntro title={clubStrings.manage.title} description={clubStrings.manage.description} />

      <AddCuratorPanel />

      {curators.length === 0 ? (
        <EmptyState
          title={clubStrings.manage.empty}
          description={clubStrings.manage.addHint}
          className="border-border mt-8 rounded-lg border border-dashed"
        />
      ) : (
        <ul className="border-border divide-border mt-8 divide-y overflow-hidden rounded-lg border">
          {curators.map((curator, index) => (
            <li key={curator.userId}>
              <PillLink
                href={routes.app.manage.curator(curator.userId)}
                className="hover:bg-surface-hover flex min-h-16 w-full items-center gap-4 rounded-none border-0 px-4 py-3"
              >
                <span className="text-content-subtle w-5 shrink-0 text-sm tabular-nums">
                  {index + 1}
                </span>

                <Avatar src={curator.avatarUrl} alt={curator.displayName} size="sm" />

                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{curator.displayName}</span>
                  <span className="text-content-muted block truncate text-sm">
                    {curator.headline ?? 'Карточка не заполнена'}
                  </span>
                </span>

                <Badge variant={curator.isPublic ? 'outline' : 'draft'} size="sm">
                  {curator.isPublic ? 'Показана' : clubStrings.curators.hidden}
                </Badge>
              </PillLink>
            </li>
          ))}
        </ul>
      )}

      <p className="text-content-subtle mt-4 text-sm">{clubStrings.manage.orderHint}</p>
    </>
  )
}
