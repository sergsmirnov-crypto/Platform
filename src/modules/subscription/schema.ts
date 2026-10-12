import { bigserial, boolean, index, jsonb, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core'

import { users } from '@/modules/identity/schema'
import { createdAt, primaryId, timestampTz, updatedAt } from '@/shared/db/columns'

/**
 * Подписки.
 *
 * Главный принцип из PRD v0.1 §7.1: решение о доступе принимает платформа,
 * а не Telegram. Источники — закрытый чат и сервис оплаты Toolsy (ADR-0031) —
 * лишь присылают факты, а состояние доступа хранится и вычисляется здесь.
 *
 * Поэтому при недоступном источнике платформа продолжает работать:
 * молчание никогда не означает «подписка кончилась».
 */

export const entitlementStatusEnum = pgEnum('entitlement_status', [
  'none',
  'active',
  /** Льготный период: доступ ещё есть, но скоро кончится */
  'grace',
  'expired',
])

export const entitlementSourceEnum = pgEnum('entitlement_source', [
  /** Членство в закрытом канале */
  'telegram_channel',
  'telegram_payment',
  /** Выдано вручную администратором */
  'manual',
  'promo',
  /** Действующая подписка в Toolsy — сервисе оплаты (ADR-0031) */
  'toolsy',
])

export const verificationStateEnum = pgEnum('verification_state', ['ok', 'stale', 'tg_unreachable'])

export const subscriptionEventTypeEnum = pgEnum('subscription_event_type', [
  'joined',
  'left',
  'kicked',
  'payment_ok',
  'payment_failed',
  'manual_grant',
  'manual_revoke',
  'expired',
  'renewed',
])

export const subscriptionEventSourceEnum = pgEnum('subscription_event_source', [
  'webhook',
  'reconcile',
  'admin',
  'payment',
])

/** Текущее состояние доступа. Одна строка на человека. */
export const entitlements = pgTable('entitlements', {
  id: primaryId(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),

  status: entitlementStatusEnum('status').notNull().default('none'),
  source: entitlementSourceEnum('source'),

  validUntil: timestampTz('valid_until'),
  graceUntil: timestampTz('grace_until'),

  /** Когда последний раз сверялись с Telegram */
  lastVerifiedAt: timestampTz('last_verified_at'),
  verificationState: verificationStateEnum('verification_state').notNull().default('ok'),

  meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),

  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

/**
 * Журнал событий подписки. Только добавление, без изменений и удалений.
 *
 * Нужен, чтобы разобрать спорный случай («мне не продлили») и восстановить
 * состояние, если уведомление от Telegram потерялось.
 */
export const subscriptionEvents = pgTable(
  'subscription_events',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    eventType: subscriptionEventTypeEnum('event_type').notNull(),
    source: subscriptionEventSourceEnum('source').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),

    occurredAt: timestampTz('occurred_at').notNull().defaultNow(),
  },
  (table) => [index('subscription_events_user_idx').on(table.userId, table.occurredAt)],
)

/**
 * Обработанные уведомления от Telegram.
 *
 * Telegram может прислать одно и то же уведомление дважды. Без этой таблицы
 * повторная доставка приведёт к двойной обработке события.
 */
export const telegramUpdates = pgTable('telegram_updates', {
  updateId: text('update_id').primaryKey(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  processedAt: timestampTz('processed_at'),
  status: text('status').notNull().default('received'),
  error: text('error'),
  createdAt: createdAt(),
})

/**
 * Членство в закрытом канале — сырой факт, пришедший от Telegram.
 *
 * Ключ здесь — идентификатор Telegram, а НЕ участник платформы. Это сделано
 * намеренно и решает вполне конкретную проблему.
 *
 * Человек оплачивает подписку, Tribute добавляет его в канал, Telegram
 * присылает нам событие — а аккаунта на платформе у него ещё нет: он ни разу
 * не заходил. Привязывать такое событие к `user_id` не к чему, и обычно
 * его в этот момент просто теряют. Тогда человек, впервые открыв платформу,
 * видит «подписки нет», хотя деньги заплачены.
 *
 * Отдельная таблица снимает вопрос: факт сохраняется всегда, а при первом
 * входе доступ вычисляется из уже накопленного. Плюс историю можно
 * пересчитать заново, если в логике найдётся ошибка.
 */
export const channelMemberships = pgTable(
  'channel_memberships',
  {
    /** Идентификатор человека в Telegram. Строкой: числа Telegram не влезают в int */
    telegramId: text('telegram_id').primaryKey(),

    /** Находится ли человек в канале прямо сейчас */
    isMember: boolean('is_member').notNull().default(false),
    /** Последний известный статус: member, left, kicked, restricted… */
    lastStatus: text('last_status'),

    /** Когда пришло событие, изменившее состояние */
    lastEventAt: timestampTz('last_event_at'),
    /** Когда мы последний раз сверялись с Telegram напрямую */
    lastVerifiedAt: timestampTz('last_verified_at'),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('channel_memberships_is_member_idx').on(table.isMember)],
)

/**
 * Подписки в Toolsy — сырой факт от сервиса оплаты (ADR-0031).
 *
 * Второй источник сведений об оплате, независимый от Telegram: Toolsy
 * сообщает о подписках напрямую. Устроено так же, как членство в канале,
 * и по той же причине: ключ — подписка Toolsy и идентификатор Telegram,
 * а не участник платформы. Человек мог оплатить, ни разу не открыв
 * платформу, — факт сохраняется и учитывается при подключении Telegram.
 *
 * Одна строка на подписку, а не на человека: у одного человека их может
 * быть несколько (продлил после отмены, купил второй тариф).
 */
export const toolsySubscriptions = pgTable(
  'toolsy_subscriptions',
  {
    /** Идентификатор подписки в Toolsy */
    id: text('id').primaryKey(),
    /** Идентификатор человека в Telegram, как его знает Toolsy */
    telegramId: text('telegram_id').notNull(),

    /** Состояние в Toolsy: active, delayed, expired, canceled */
    status: text('status').notNull(),
    /** Конец оплаченного периода по Toolsy. Только для справки — см. ADR-0031 */
    expiresAt: timestampTz('expires_at'),
    productId: text('product_id'),

    /**
     * Когда подписку последний раз меняли в самом Toolsy.
     *
     * По нему отсекаются устаревшие сведения: уведомления могут прийти
     * не по порядку, а старое не должно затирать новое
     */
    sourceUpdatedAt: timestampTz('source_updated_at'),
    /** Когда последний раз сверялись с Toolsy напрямую */
    lastVerifiedAt: timestampTz('last_verified_at'),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('toolsy_subscriptions_telegram_idx').on(table.telegramId),
    index('toolsy_subscriptions_status_idx').on(table.status),
  ],
)
