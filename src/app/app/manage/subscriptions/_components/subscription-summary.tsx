import { subscriptionStrings } from '@/modules/subscription'
import type { SubscriptionSummary } from '@/modules/subscription'

/**
 * Верхняя часть экрана подписок.
 *
 * ─────────────────────────────────────────────────────────────────
 * ГЛАВНОЕ ЗДЕСЬ — НЕ ЧИСЛА, А ПРЕДУПРЕЖДЕНИЕ
 *
 * Числа по состояниям приятно смотреть, но они не требуют действий.
 * Строка «сверка не выполнялась больше суток» требует — и это
 * единственное место во всей платформе, где видно, что связь
 * с Telegram оборвалась.
 *
 * Поломка тихая: уведомления перестают приходить, ошибок нет, доступ
 * у всех сохраняется по последнему известному состоянию. Обнаруживается
 * она обычно через неделю, когда кто-то жалуется, что оплатил
 * и ничего не открылось.
 * ─────────────────────────────────────────────────────────────────
 */

/** Насколько давняя сверка считается тревожной */
const STALE_HOURS = 30

export function SubscriptionSummaryCard({ summary }: { summary: SubscriptionSummary }) {
  const strings = subscriptionStrings.manage
  const isStale = isVerificationStale(summary.lastVerifiedAt)

  return (
    <div className="space-y-4">
      {isStale ? (
        <p className="border-danger text-danger rounded-lg border px-4 py-3 text-sm">
          {strings.staleWarning}
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Counter value={summary.active} label={strings.summary.active} />
        <Counter value={summary.grace} label={strings.summary.grace} />
        <Counter value={summary.expired} label={strings.summary.expired} />
        <Counter value={summary.attention} label={strings.summary.attention} highlight />
      </dl>

      <p className="text-content-subtle text-xs">
        {strings.summary.lastVerified}:{' '}
        {summary.lastVerifiedAt
          ? formatDateTime(summary.lastVerifiedAt)
          : strings.summary.neverVerified}
      </p>
    </div>
  )
}

function Counter({
  value,
  label,
  highlight,
}: {
  value: number
  label: string
  highlight?: boolean
}) {
  return (
    <div className="border-border rounded-lg border p-4">
      <dt className="text-content-muted text-xs">{label}</dt>
      <dd
        className={`font-display text-2xl font-bold tabular-nums ${
          highlight && value > 0 ? 'text-danger' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  )
}

function isVerificationStale(lastVerifiedAt: Date | null): boolean {
  if (!lastVerifiedAt) return true

  return Date.now() - lastVerifiedAt.getTime() > STALE_HOURS * 60 * 60 * 1000
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
