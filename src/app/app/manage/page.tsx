import { CheckCircle2, Plus } from 'lucide-react'
import Link from 'next/link'

import { logStrings } from '@/modules/audit'
import { routes } from '@/shared/routes'
import { PillLink } from '@/ui'

import { PageIntro } from '../_components/page-intro'
import { requireManageAccess } from '../_lib/guards'
import { getManageOverview } from '../_lib/manage-overview'
import { getViewer, viewerCan } from '../_lib/viewer'

import { OverviewCounters } from './_components/overview-counters'
import { OverviewTasks } from './_components/overview-tasks'
import { RecentActions } from './_components/recent-actions'

export const metadata = { title: 'Управление' }

/**
 * Обзор раздела «Управление».
 *
 * ─────────────────────────────────────────────────────────────────
 * ЭКРАН ОТВЕЧАЕТ НА ОДИН ВОПРОС: «ЧТО МНЕ СЕЙЧАС ДЕЛАТЬ»
 *
 * Поэтому наверху не числа, а заботы — то, о чём иначе никто
 * не напомнит: эфир прошёл, а запись не привязали; модуль курса открыт
 * участникам, а уроков в нём нет; файл не доехал до хранилища. Всё это
 * поломки тихие: ошибок нет, страницы открываются, а участник упирается
 * в пустоту.
 *
 * Числа ниже — не задача, а самочувствие: «за неделю вышло два разбора»
 * отвечает на вопрос «мы вообще двигаемся». Ставить их первыми значило
 * бы предложить куратору любоваться статистикой вместо работы.
 *
 * Права проверяются трижды и по-разному: раздел целиком — в разметке,
 * что спрашивать у базы — в сборке (`manage-overview.ts`), само право
 * на данные — внутри модулей. Здесь остаётся только отрисовка.
 * ─────────────────────────────────────────────────────────────────
 */
export default async function ManageHubPage() {
  await requireManageAccess()

  const viewer = await getViewer()
  if (!viewer.userId) return null

  const overview = await getManageOverview({ ...viewer, userId: viewer.userId })

  return (
    <>
      <PageIntro
        title="Управление"
        description="Что требует внимания, что вышло за неделю, что делала команда"
      />

      <div className="mt-6 flex flex-wrap gap-2">
        {viewerCan(viewer, 'songs.create') ? (
          <PillLink href={routes.app.manage.newSong()} size="md">
            <Plus size={16} aria-hidden />
            Новый разбор
          </PillLink>
        ) : null}

        {viewerCan(viewer, 'streams.create') ? (
          <PillLink href={routes.app.manage.newStream()} size="md">
            <Plus size={16} aria-hidden />
            Новый эфир
          </PillLink>
        ) : null}
      </div>

      {overview.tasks.length > 0 ? (
        <OverviewTasks tasks={overview.tasks} />
      ) : overview.isCalm ? (
        <p className="border-border text-content-muted mt-8 flex items-center gap-3 rounded-lg border border-dashed px-4 py-6 text-sm">
          <CheckCircle2 size={20} aria-hidden className="text-content-subtle shrink-0" />
          Всё в порядке: эфиры с записями, модули курса заполнены, забытых черновиков нет.
        </p>
      ) : null}

      <OverviewCounters counters={overview.counters} />

      {overview.recentActions.length > 0 ? (
        <section className="mt-10">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-lg font-bold">Последние действия команды</h2>

            <Link
              href={routes.app.manage.logs()}
              className="text-content-muted hover:text-content text-sm"
            >
              {logStrings.title}
            </Link>
          </div>

          <RecentActions entries={overview.recentActions} />
        </section>
      ) : null}
    </>
  )
}
