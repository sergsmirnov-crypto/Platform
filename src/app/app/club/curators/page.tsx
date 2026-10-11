import { clubStrings } from '@/modules/club'
import { getCurators } from '@/modules/club/service'
import { EmptyState } from '@/ui'

import { PageIntro } from '../../_components/page-intro'
import { getViewer, viewerCan } from '../../_lib/viewer'

import { CuratorCardItem } from './_components/curator-card'

export const metadata = { title: 'Кураторы' }

/**
 * Страница «Кураторы».
 *
 * ─────────────────────────────────────────────────────────────────
 * ВХОД В БИБЛИОТЕКУ ПО УЧИТЕЛЮ
 *
 * Эту страницу открывают один-два раза за всё время — сама по себе
 * она не ежедневный раздел (PRD v0.1 §3.2). Но она делает возможным
 * другой способ выбирать материал: не «покажи мне разборы уровня
 * Intermediate», а «покажи всё, что ведёт Иван».
 *
 * Для сообщества это естественнее жанра: люди привязываются к людям.
 * Поэтому у каждого куратора на странице собрано всё, что он вёл, —
 * и это, а не биография, здесь главное.
 * ─────────────────────────────────────────────────────────────────
 */
export default async function CuratorsPage() {
  const viewer = await getViewer()
  if (!viewer.userId) return null

  // Скрытые карточки видит тот, кто их правит: заполнять свою страницу
  // вслепую, не видя её в списке, невозможно
  const canSeeHidden = viewerCan(viewer, 'curators.edit')
  const curators = await getCurators({ userId: viewer.userId, canSeeHidden })

  return (
    <>
      <PageIntro
        title={clubStrings.curators.title}
        description={clubStrings.curators.description}
      />

      {curators.length === 0 ? (
        <EmptyState
          title={clubStrings.curators.empty}
          description={clubStrings.curators.emptyHint}
          className="border-border rounded-lg border border-dashed"
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {curators.map((curator) => (
            <li key={curator.userId}>
              <CuratorCardItem curator={curator} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
