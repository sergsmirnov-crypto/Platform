/**
 * Конечный автомат подписки.
 *
 * Отвечает на один вопрос: каким должно стать состояние доступа после
 * очередного события. Чистые функции без базы и без обращений наружу —
 * поэтому все переходы проверяются тестами, а не выясняются на живых
 * участниках, у которых внезапно пропал оплаченный доступ.
 *
 * Состояния и переходы (PRD v0.1 §4.6, §7.3):
 *
 *     none ──оплата подтверждена──► active
 *     active ──подтверждения больше нет──► grace (доступ сохраняется на льготный
 *                                         период, см. appConfig.subscription.graceDays)
 *     grace ──оплата подтверждена──► active  (льготный период сбрасывается)
 *     grace ──срок вышел──► expired
 *     expired ──оплата подтверждена──► active
 *
 * «Оплата подтверждена» — человек в закрытом чате или у него действующая
 * подписка в Toolsy (ADR-0031). Какой именно источник, записывается
 * в `source`, но на переходы не влияет.
 *
 * Льготный период существует не ради доброты: он покрывает потерянное
 * уведомление, задержку платежа и отпуск. Без него любой сбой Telegram
 * означал бы толпу людей, потерявших оплаченный доступ.
 */

export type EntitlementStatus = 'none' | 'active' | 'grace' | 'expired'
export type EntitlementSource =
  'telegram_channel' | 'telegram_payment' | 'manual' | 'promo' | 'toolsy'

/**
 * Источники, которые подтверждают оплату автоматически.
 *
 * Их два: членство в закрытом чате и подписка в Toolsy (ADR-0031).
 * Доступ открыт, если оплату подтверждает хотя бы один, — решает это
 * не автомат, а сервис, который сводит факты от обоих
 */
export type PaidSource = 'telegram_channel' | 'toolsy'

/** Текущее состояние доступа */
export type EntitlementState = {
  status: EntitlementStatus
  source: EntitlementSource | null
  validUntil: Date | null
  graceUntil: Date | null
}

/** Что произошло */
export type EntitlementEvent =
  /** Оплату подтверждает хотя бы один источник */
  | { type: 'paid_confirmed'; source: PaidSource }
  /** Ни один источник оплату больше не подтверждает */
  | { type: 'paid_lost' }
  /** Доступ выдан вручную администратором */
  | { type: 'manual_grant'; validUntil: Date | null }
  /** Доступ отозван вручную администратором */
  | { type: 'manual_revoke' }
  /** Проверка по времени: не истёк ли льготный период или срок */
  | { type: 'time_passed' }

export type EntitlementDecision = {
  next: EntitlementState
  /** Изменилось ли что-нибудь: если нет, писать в базу не надо */
  changed: boolean
}

const NO_ACCESS: EntitlementStatus[] = ['none', 'expired']

/** Даёт ли это состояние доступ к платному содержимому */
export function grantsAccess(status: EntitlementStatus): boolean {
  return !NO_ACCESS.includes(status)
}

function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000)
}

function isSame(a: EntitlementState, b: EntitlementState): boolean {
  return (
    a.status === b.status &&
    a.source === b.source &&
    a.validUntil?.getTime() === b.validUntil?.getTime() &&
    a.graceUntil?.getTime() === b.graceUntil?.getTime()
  )
}

/**
 * Действующая ручная выдача сильнее автоматики.
 *
 * Если администратор выдал доступ руками, событие из Telegram не должно
 * его отобрать: ручная выдача применяется как раз в спорных случаях,
 * когда автоматика ошиблась (PRD v0.1 §7.3, уровень 4).
 *
 * Важно: приоритет есть только у выдачи, которая ДЕЙСТВУЕТ. Ручной отзыв
 * и истёкшая ручная выдача автоматику не блокируют — то есть человек,
 * у которого отозвали ручной доступ, снова получит его, честно оплатив
 * подписку. Это осознанное решение: ручной отзыв здесь означает
 * «отменить ошибочную выдачу», а не «наказать».
 *
 * Для постоянной блокировки нарушителя есть отдельный механизм — право
 * `users.ban` (PRD v0.3 §2.2). Смешивать наказание с подпиской нельзя:
 * иначе оплата снимала бы блокировку.
 */
function isManualOverride(state: EntitlementState): boolean {
  return state.source === 'manual' && grantsAccess(state.status)
}

export type ApplyOptions = {
  /** Длительность льготного периода в днях */
  graceDays: number
  /** Текущий момент */
  now: Date
}

export function applyEvent(
  current: EntitlementState,
  event: EntitlementEvent,
  options: ApplyOptions,
): EntitlementDecision {
  const { now, graceDays } = options
  const next = computeNext(current, event, now, graceDays)

  return { next, changed: !isSame(current, next) }
}

function computeNext(
  current: EntitlementState,
  event: EntitlementEvent,
  now: Date,
  graceDays: number,
): EntitlementState {
  switch (event.type) {
    case 'paid_confirmed': {
      // Ручная выдача не перезаписывается: она могла быть сделана
      // с другим сроком и по другой причине
      if (isManualOverride(current)) return current

      return {
        status: 'active',
        source: event.source,
        // Бессрочно, пока источник подтверждает оплату: конец наступает
        // по явному событию, а не по дате (ADR-0031)
        validUntil: null,
        graceUntil: null,
      }
    }

    case 'paid_lost': {
      if (isManualOverride(current)) return current

      // Из состояния «доступа нет» потеря подтверждения ничего не меняет:
      // нельзя уйти в льготный период, не имея доступа
      if (!grantsAccess(current.status)) return current

      // Уже в льготном периоде — срок не продлевается повторным событием
      if (current.status === 'grace') return current

      return {
        status: 'grace',
        source: current.source ?? 'telegram_channel',
        validUntil: current.validUntil,
        graceUntil: addDays(now, graceDays),
      }
    }

    case 'manual_grant': {
      return {
        status: 'active',
        source: 'manual',
        validUntil: event.validUntil,
        graceUntil: null,
      }
    }

    case 'manual_revoke': {
      return {
        status: 'expired',
        source: 'manual',
        validUntil: null,
        graceUntil: null,
      }
    }

    case 'time_passed': {
      // Льготный период истёк
      if (current.status === 'grace' && current.graceUntil && current.graceUntil <= now) {
        return { ...current, status: 'expired', graceUntil: null }
      }

      // Срок ручной выдачи истёк — уходим в льготный период,
      // чтобы человек успел продлить, а не потерял доступ посреди урока
      if (current.status === 'active' && current.validUntil && current.validUntil <= now) {
        return { ...current, status: 'grace', graceUntil: addDays(now, graceDays) }
      }

      return current
    }
  }
}

/**
 * Сколько дней осталось до потери доступа.
 *
 * Нужно для баннера «подписка истекает через N дней». Возвращает `null`,
 * если конца не видно: автоматическое подтверждение оплаты бессрочно.
 */
export function daysUntilLoss(state: EntitlementState, now: Date): number | null {
  const deadline = state.status === 'grace' ? state.graceUntil : state.validUntil
  if (!deadline) return null

  const days = Math.ceil((deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  return Math.max(0, days)
}
