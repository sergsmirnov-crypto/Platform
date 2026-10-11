import { getAccessStatus } from '@/modules/subscription'
import { routes } from '@/shared/routes'
import { LinkButton } from '@/ui'

/**
 * Состояние подписки.
 *
 * ПОКАЗЫВАЕТСЯ ТОЛЬКО ТОГДА, КОГДА ЕСТЬ О ЧЁМ СКАЗАТЬ: льготный период
 * заканчивается или доступ уже потерян. Человеку с действующей подпиской
 * блок не нужен — напоминание о том, что всё в порядке, только занимает
 * первый экран и приучает не читать сообщения платформы.
 */
export async function SubscriptionBlock({ userId }: { userId: string }) {
  const access = await getAccessStatus(userId)

  if (access.status === 'active') return null

  const isLost = !access.hasAccess

  return (
    <section
      className={`rounded-xl border p-5 ${
        isLost ? 'border-danger/40 bg-danger/5' : 'border-accent/50 bg-accent/10'
      }`}
    >
      <h2 className="font-semibold">
        {isLost ? 'Подписка закончилась' : 'Подписка скоро закончится'}
      </h2>

      <p className="text-content-muted mt-1 text-sm">
        {isLost
          ? 'Профиль, прогресс и заметки сохранены. Доступ вернётся сразу после продления.'
          : access.daysLeft !== null
            ? `Доступ сохраняется ещё ${access.daysLeft} дн. Продлите, чтобы ничего не прерывалось.`
            : 'Продлите подписку, чтобы доступ не прерывался.'}
      </p>

      <LinkButton href={routes.app.subscriptionExpired()} className="mt-4">
        Что делать
      </LinkButton>
    </section>
  )
}
