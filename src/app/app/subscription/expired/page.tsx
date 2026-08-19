import { redirect } from 'next/navigation'

import { subscriptionStrings } from '@/modules/subscription'
import { routes } from '@/shared/routes'
import { LinkButton } from '@/ui'

import { getAccessForCurrentUser } from '../../_lib/guards'

/**
 * Экран продления подписки.
 *
 * Главная задача — не сообщить о потере доступа, а удержать: человек видит
 * сохранённый прогресс и понимает, что при возвращении ничего не пропало
 * (PRD v0.1 §4.6). Поэтому цифры прогресса здесь важнее кнопки оплаты.
 *
 * Прогресс появится на Этапе 10 вместе с самим учётом прогресса; пока
 * показываем структуру.
 *
 * Человека с действующей подпиской уводим обратно: попав сюда по старой
 * ссылке, он не должен решить, что доступ пропал.
 */

export const metadata = { title: 'Подписка закончилась' }

export default async function SubscriptionExpiredPage() {
  const access = await getAccessForCurrentUser()

  if (access?.hasAccess) {
    redirect(routes.app.dashboard())
  }

  return (
    <section className="mx-auto max-w-lg px-6 py-16">
      <h1 className="text-2xl font-bold">{subscriptionStrings.expired.title}</h1>
      <p className="mt-3 text-sm opacity-80">{subscriptionStrings.expired.description}</p>

      <div className="mt-8 rounded border px-5 py-4">
        <p className="text-xs tracking-wide uppercase opacity-60">Что сохранено</p>
        <ul className="mt-2 space-y-1 text-sm">
          <li>Профиль и настройки</li>
          <li>Прогресс по курсу и разборам</li>
          <li>Избранное и личные заметки</li>
        </ul>
      </div>

      <div className="mt-8">
        <LinkButton href={routes.app.club.telegram()}>
          {subscriptionStrings.expired.action}
        </LinkButton>
      </div>

      <p className="mt-8 text-xs opacity-60">
        Остаются открытыми:{' '}
        <a href={routes.app.me.profile()} className="underline">
          профиль
        </a>
        ,{' '}
        <a href={routes.app.me.progress()} className="underline">
          прогресс
        </a>
        ,{' '}
        <a href={routes.app.club.about()} className="underline">
          страницы клуба
        </a>
        .
      </p>
    </section>
  )
}
