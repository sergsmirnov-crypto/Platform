import { getTeam } from '@/modules/access/team'

import { PageIntro } from '../../_components/page-intro'
import { requireManagePermission } from '../../_lib/guards'

import { TeamList } from './_components/team-list'

export const metadata = { title: 'Команда' }

/**
 * Экран «Управление → Команда».
 *
 * ─────────────────────────────────────────────────────────────────
 * ЕДИНСТВЕННОЕ МЕСТО, ГДЕ ВЫДАЮТСЯ ПРАВА
 *
 * До этого экрана роль можно было выдать только запросом в базу —
 * то есть фактически никак. Всё остальное управление платформой уже
 * работает, но работает только у владельца, потому что права есть
 * только у него.
 *
 * Показываются лишь те, у кого есть роль. Обычных участников
 * двести пятьдесят, и для них существует соседний экран.
 * ─────────────────────────────────────────────────────────────────
 */
export default async function TeamPage() {
  const viewer = await requireManagePermission('users.roles')

  const members = await getTeam(viewer.userId)

  return (
    <>
      <PageIntro title="Команда" description="Кто может редактировать платформу и что именно" />

      <TeamList members={members} />
    </>
  )
}
