import { routes } from '@/shared/routes'

import { requireMember, requireActiveSubscription } from '../_lib/guards'

/**
 * Разметка раздела «Обучение».
 *
 * Разборы, курс и материалы — платное содержимое. Человека без действующей
 * подписки уводим на экран продления, а не показываем пустые страницы
 * или сообщение об ошибке.
 */
export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  const session = await requireMember(routes.app.learn.index())

  if (session) {
    await requireActiveSubscription(session.user.id)
  }

  return <>{children}</>
}
