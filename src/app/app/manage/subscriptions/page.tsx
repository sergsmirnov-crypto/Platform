import { getSubscriptionOverview, subscriptionStrings } from '@/modules/subscription'
import type { SubscriptionFilter } from '@/modules/subscription'
import { routes } from '@/shared/routes'
import { PillLink } from '@/ui'

import { PageIntro } from '../../_components/page-intro'
import { requireManagePermission } from '../../_lib/guards'

import { SubscriptionEvents, SubscriptionList } from './_components/subscription-list'
import { SubscriptionSummaryCard } from './_components/subscription-summary'

export const metadata = { title: 'Подписки' }

/**
 * Экран подписок.
 *
 * ─────────────────────────────────────────────────────────────────
 * ДВА ВОПРОСА, И ВТОРОЙ ВАЖНЕЕ
 *
 * «Что с подпиской у этого человека» — повседневный, приходит
 * из чата поддержки, решается переходом в карточку участника.
 *
 * «Работает ли связь с Telegram» — редкий, но такой, который никто
 * не задаёт, пока не станет поздно. Уведомления перестают приходить
 * молча: ошибок нет, доступ у всех сохраняется по последнему известному
 * состоянию, и обнаруживается это через неделю. Поэтому сводка и лента
 * событий стоят выше списка.
 * ─────────────────────────────────────────────────────────────────
 */

const FILTERS: { value: Exclude<SubscriptionFilter, null>; label: string }[] = [
  { value: 'active', label: subscriptionStrings.status.active },
  { value: 'grace', label: subscriptionStrings.status.grace },
  { value: 'expired', label: subscriptionStrings.status.expired },
  { value: 'attention', label: subscriptionStrings.manage.filters.attention },
]

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ManageSubscriptionsPage({ searchParams }: Props) {
  const viewer = await requireManagePermission('subs.view')

  const filter = parseFilter((await searchParams).status)
  const { summary, items, events } = await getSubscriptionOverview(viewer.userId, filter)

  return (
    <>
      <PageIntro
        title={subscriptionStrings.manage.title}
        description={subscriptionStrings.manage.description}
      />

      <SubscriptionSummaryCard summary={summary} />

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium">{subscriptionStrings.manage.events.title}</h2>
        <SubscriptionEvents events={events} />
      </section>

      <div className="mt-8 flex flex-wrap gap-2">
        <PillLink href={routes.app.manage.subscriptions()} active={filter === null}>
          {subscriptionStrings.manage.filters.all}
        </PillLink>

        {FILTERS.map((option) => (
          <PillLink
            key={option.value}
            href={`${routes.app.manage.subscriptions()}?status=${option.value}`}
            active={filter === option.value}
          >
            {option.label}
          </PillLink>
        ))}
      </div>

      <div className="mt-4">
        <SubscriptionList items={items} />
      </div>
    </>
  )
}

/** Неизвестное значение в адресе — это «все», а не пятисотая ошибка */
function parseFilter(value: string | string[] | undefined): SubscriptionFilter {
  const single = Array.isArray(value) ? value[0] : value
  const known = FILTERS.some((option) => option.value === single)

  return known ? (single as SubscriptionFilter) : null
}
