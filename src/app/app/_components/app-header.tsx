import { Settings } from 'lucide-react'
import Link from 'next/link'

import { getAccessStatus, subscriptionStrings } from '@/modules/subscription'
import { routes } from '@/shared/routes'

import { getViewer } from '../_lib/viewer'

import { NotificationBell } from './notification-bell'
import { ProfileMenu } from './profile-menu'
import { SearchLauncher } from './search-launcher'

/**
 * Шапка платформы.
 *
 * Держит название клуба, состояние подписки, поиск, колокольчик
 * уведомлений и меню профиля.
 *
 * Серверный компонент: состояние подписки и права читаются из базы,
 * и тащить это в браузер незачем.
 *
 * Прилипает не к нулю, а к высоте полосы режима просмотра: когда полосы
 * нет, `--banner-h` равна нулю и поведение обычное.
 */

const TONE: Record<string, string> = {
  active: 'text-content-muted',
  grace: 'bg-accent text-accent-content',
  expired: 'bg-danger text-danger-content',
  none: 'text-content-subtle',
}

type AppHeaderProps = {
  /** Есть ли доступные пункты в разделе «Управление» с учётом режима просмотра */
  canManage: boolean
}

export async function AppHeader({ canManage }: AppHeaderProps) {
  const viewer = await getViewer()
  const access = viewer.userId ? await getAccessStatus(viewer.userId) : null

  return (
    <header className="border-border bg-surface sticky top-[var(--banner-h)] z-30 border-b">
      <div className="flex h-14 items-center gap-4 px-4 md:px-6">
        <Link href={routes.app.dashboard()} className="text-base font-bold">
          Гитарный клуб
        </Link>

        <div className="ml-auto flex items-center gap-2">
          {access ? (
            <Link
              href={access.hasAccess ? routes.app.me.settings() : routes.app.subscriptionExpired()}
              className={`hidden rounded-full px-3 py-1 text-xs sm:block ${TONE[access.status] ?? ''}`}
            >
              {subscriptionStrings.status[access.status]}
              {access.daysLeft !== null ? ` · ${access.daysLeft} дн.` : ''}
            </Link>
          ) : null}

          {/*
            На телефоне бокового меню нет, поэтому вход в «Управление»
            переезжает в шапку: иначе куратор не смог бы туда попасть
            вообще — а публиковать разборы с телефона он будет.

            В режиме просмотра доступных пунктов не остаётся, и кнопка
            исчезает сама — отдельной проверки не требуется.
          */}
          <SearchLauncher />

          {viewer.userId ? <NotificationBell userId={viewer.userId} /> : null}

          {canManage ? (
            <Link
              href={routes.app.manage.index()}
              aria-label="Управление"
              className="text-content-muted hover:text-content flex h-11 w-11 items-center justify-center md:hidden"
            >
              <Settings size={20} aria-hidden />
            </Link>
          ) : null}

          {viewer.session ? (
            <ProfileMenu
              displayName={viewer.session.user.displayName}
              avatarUrl={viewer.session.user.avatarUrl}
              canManage={viewer.canManageInReality}
              isPreview={viewer.isPreview}
            />
          ) : null}
        </div>
      </div>
    </header>
  )
}
