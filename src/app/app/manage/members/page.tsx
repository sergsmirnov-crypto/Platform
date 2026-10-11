import { directoryStrings, hasActiveMemberFilters, parseMemberFilters } from '@/modules/identity'
import { getMembersPage } from '@/modules/identity/directory'
import { EmptyState } from '@/ui'

import { PageIntro } from '../../_components/page-intro'
import { requireManagePermission } from '../../_lib/guards'

import { MemberFiltersBar, MemberPagination, MemberSortBar } from './_components/member-filters'
import { MemberRow } from './_components/member-row'
import { MemberSearch } from './_components/member-search'

export const metadata = { title: 'Участники' }

/**
 * Список участников клуба.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЭКРАН СУЩЕСТВУЕТ РАДИ ОДНОГО ВОПРОСА
 *
 * «Человек написал, что у него ничего не открывается». Всё, что здесь
 * есть, отвечает на него: кто это, платит ли, когда заходил, не закрыт
 * ли ему доступ. Всё, чего здесь нет, — заметки, подробности прогресса,
 * переписка — на него не отвечает и потому не показывается.
 *
 * Соблазн сделать из этого «панель аналитики сообщества» надо гасить:
 * такая панель нужна раз в квартал, а поиск человека — каждую неделю.
 * ─────────────────────────────────────────────────────────────────
 */

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ManageMembersPage({ searchParams }: Props) {
  // Раздела не существует для того, у кого нет права: не «нет доступа»,
  // а «нет такой страницы» — меньше поводов гадать, что там прячут
  const viewer = await requireManagePermission('users.view')

  const filters = parseMemberFilters(await searchParams)
  const { members, total, page, pageCount } = await getMembersPage(viewer.userId, filters)

  return (
    <>
      <PageIntro title={directoryStrings.title} description={directoryStrings.description} />

      <div className="space-y-4">
        <MemberSearch filters={filters} total={total} />
        <MemberFiltersBar filters={filters} />
        <MemberSortBar filters={filters} />
      </div>

      {members.length === 0 ? (
        <EmptyState
          className="border-border mt-8 rounded-lg border border-dashed"
          title={
            hasActiveMemberFilters(filters)
              ? directoryStrings.empty.filtered
              : directoryStrings.empty.none
          }
          description={
            hasActiveMemberFilters(filters)
              ? directoryStrings.empty.filteredHint
              : directoryStrings.empty.noneHint
          }
        />
      ) : (
        <ul className="border-border divide-border mt-6 divide-y overflow-hidden rounded-lg border">
          {members.map((member) => (
            <li key={member.userId}>
              <MemberRow member={member} />
            </li>
          ))}
        </ul>
      )}

      <MemberPagination filters={filters} page={page} pageCount={pageCount} />
    </>
  )
}
