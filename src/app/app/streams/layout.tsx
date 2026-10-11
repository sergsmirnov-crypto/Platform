import { routes } from '@/shared/routes'

import { requireActiveSubscription, requireMember } from '../_lib/guards'

/**
 * Разметка раздела «Эфиры».
 *
 * Записи эфиров — платное содержимое, как и разборы.
 */
export default async function StreamsLayout({ children }: { children: React.ReactNode }) {
  const session = await requireMember(routes.app.streams.index())

  if (session) {
    await requireActiveSubscription(session.user.id)
  }

  return <>{children}</>
}
