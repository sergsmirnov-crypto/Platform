import { routes } from '@/shared/routes'

import { AppHeader } from './_components/app-header'
import { PreviewBanner } from './_components/preview-banner'
import { Sidebar } from './_components/sidebar'
import { TabBar } from './_components/tab-bar'
import { getVisibleManageItems, requireMember, requireOnboarding } from './_lib/guards'
import { getViewer } from './_lib/viewer'

import type { CSSProperties } from 'react'

/**
 * Разметка закрытой зоны.
 *
 * Здесь проходит настоящая граница доступа: разметка выполняется на сервере,
 * имеет доступ к базе и может проверить, что сессия действительно живая.
 * Middleware такой проверки не делает и делать не должен (ADR-0003).
 *
 * Проверка подписки живёт не здесь, а в разметке платных разделов: участник
 * без подписки не теряет профиль, прогресс и страницы клуба — он должен,
 * вернувшись через полгода, увидеть «ты остановился на уроке 7», а не пустоту.
 *
 * Меню строится на сервере уже отфильтрованным по правам: браузер не получает
 * даже названий разделов, которые человеку недоступны.
 *
 * **Про `--banner-h`.** Высота полосы режима просмотра задана здесь один раз
 * и подхватывается шапкой и боковым меню, которые прилипают к верху экрана.
 * Без общей величины смещения пришлось бы держать одно и то же число
 * в трёх файлах, и при первой же правке высоты полосы они разъехались бы.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Возвращаемое значение здесь не нужно: сессией пользуются шапка и меню,
  // каждое через `getViewer`. Вызов важен побочным действием — перенаправлением.
  await requireMember(routes.app.dashboard())

  // Знакомство и согласие с документами — до всего остального. Знакомство
  // сюда не попадает: у него своя разметка, замещающая эту
  await requireOnboarding()

  const viewer = await getViewer()
  const manageItems = await getVisibleManageItems()

  const bannerHeight = { '--banner-h': viewer.isPreview ? '2.5rem' : '0px' } as CSSProperties

  return (
    <div className="bg-surface min-h-dvh" style={bannerHeight}>
      {viewer.isPreview ? <PreviewBanner /> : null}

      <AppHeader canManage={manageItems.length > 0} />

      <div className="flex">
        <Sidebar manageItems={manageItems} />

        {/*
          Поля страницы заданы здесь, а не на каждой странице: иначе через
          три этапа отступы разъедутся, и это будет видно при переходе
          между разделами. Отступ снизу — под мобильную панель.
        */}
        <main className="min-w-0 flex-1 px-4 pt-6 pb-24 md:px-8 md:pt-8 md:pb-10">{children}</main>
      </div>

      <TabBar />
    </div>
  )
}
