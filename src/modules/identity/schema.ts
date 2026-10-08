import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { uuid } from 'drizzle-orm/pg-core'

import { createdAt, deletedAt, primaryId, timestampTz, updatedAt } from '@/shared/db/columns'

import type { AnyPgColumn } from 'drizzle-orm/pg-core'

/**
 * Пользователи, способы входа и сессии.
 *
 * Ключевое решение: способ входа вынесен из таблицы пользователей
 * в отдельную таблицу `auth_identities`. Причина — в PRD v0.1 §0, пункт 1:
 * Telegram не должен быть единственной дверью в оплаченный контент.
 * Добавить вход по почте или ключу доступа позже можно будет без изменения
 * структуры, просто новой строкой.
 */

export const skillLevelEnum = pgEnum('skill_level', ['beginner', 'intermediate', 'advanced'])
export const authProviderEnum = pgEnum('auth_provider', ['telegram', 'email', 'passkey'])

/**
 * Видимость визитки участника.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПО УМОЛЧАНИЮ ЗАКРЫТО — И ЭТО НЕ ОСТОРОЖНИЧАНЬЕ
 *
 * Человек, регистрировавшийся год назад, не давал согласия показывать
 * свой город и рассказ о себе полутора сотням людей. Согласие нельзя
 * получить задним числом настройкой по умолчанию.
 *
 * Обратный порядок — «открыто, кто хочет, тот закроет» — дал бы более
 * живой раздел с первого дня и был бы нечестным.
 *
 * `club` означает «видно участникам клуба», а не «видно интернету»:
 * платформа закрыта целиком, публичной витрины у визиток нет
 * ─────────────────────────────────────────────────────────────────
 */
export const profileVisibilityEnum = pgEnum('profile_visibility', ['private', 'club'])

export const users = pgTable(
  'users',
  {
    id: primaryId(),

    displayName: text('display_name').notNull(),

    /**
     * Идентификатор загруженной фотографии, а не её адрес.
     *
     * Из него собираются имена файлов всех размеров и, уже через
     * настройки хранилища, — адрес. Готовая ссылка в базе означала бы,
     * что смена сети доставки требует правки строк у каждого участника.
     * Пусто — фотографии нет, показывается силуэт.
     */
    avatarId: text('avatar_id'),
    avatarUpdatedAt: timestampTz('avatar_updated_at'),

    city: text('city'),
    bio: text('bio'),

    /** Год начала игры на гитаре — для подбора материалов по уровню */
    playingSince: integer('playing_since'),
    skillLevel: skillLevelEnum('skill_level'),

    /** Ссылки на соцсети: { vk, youtube, ... } */
    socials: jsonb('socials').$type<Record<string, string>>().notNull().default({}),
    /** Цели из онбординга */
    goals: text('goals').array().notNull().default([]),

    /**
     * Любимые исполнители — свободный ввод: список групп бесконечен.
     * Жанры, наоборот, выбираются из списка, иначе «рок» и «Рок» станут
     * разными жанрами и подбор материалов перестанет работать
     */
    favoriteArtists: text('favorite_artists').array().notNull().default([]),
    favoriteGenres: text('favorite_genres').array().notNull().default([]),

    /** Показывать ли визитку остальным участникам. См. перечисление выше */
    profileVisibility: profileVisibilityEnum('profile_visibility').notNull().default('private'),

    onboardingStep: integer('onboarding_step').notNull().default(0),
    onboardingDoneAt: timestampTz('onboarding_done_at'),

    /** Личные настройки: тема, уведомления, автовоспроизведение */
    settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),

    /**
     * Блокировка участника.
     *
     * ─────────────────────────────────────────────────────────────────
     * ЭТО НЕ ТО ЖЕ САМОЕ, ЧТО ОТСУТСТВИЕ ПОДПИСКИ
     *
     * Подписка отвечает на вопрос «оплачено ли», блокировка — на вопрос
     * «пускать ли вообще». Человек, вышедший из платного канала, теряет
     * доступ к урокам, но остаётся участником клуба: у него есть профиль,
     * прогресс и возможность вернуться, оплатив снова.
     *
     * Заблокированный не попадает на платформу вовсе. Случай редкий —
     * доступ и так отрезается выходом из канала, — но ничем другим
     * не закрывается ситуация «человек платит и остаётся в канале,
     * но его не хотят видеть».
     * ─────────────────────────────────────────────────────────────────
     */
    blockedAt: timestampTz('blocked_at'),
    /**
     * Причина обязательна при блокировке.
     *
     * Через полгода «а почему он заблокирован» — вопрос без ответа,
     * если причину не спросили в момент действия.
     */
    blockedReason: text('blocked_reason'),
    /**
     * Кто заблокировал. Ссылка на ту же таблицу, поэтому тип колонки
     * приходится указывать явно: иначе вывод типов уходит в бесконечность
     */
    blockedBy: uuid('blocked_by').references((): AnyPgColumn => users.id, {
      onDelete: 'set null',
    }),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
    lastSeenAt: timestampTz('last_seen_at'),
    deletedAt: deletedAt(),
  },
  (table) => [index('users_last_seen_idx').on(table.lastSeenAt)],
)

export const authIdentities = pgTable(
  'auth_identities',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    provider: authProviderEnum('provider').notNull(),
    /** Идентификатор человека у поставщика входа: telegram_id или адрес почты */
    providerUserId: text('provider_user_id').notNull(),
    /** Дополнительные данные от поставщика: имя пользователя, фото */
    providerData: jsonb('provider_data').$type<Record<string, unknown>>().notNull().default({}),

    isPrimary: boolean('is_primary').notNull().default(false),
    verifiedAt: timestampTz('verified_at'),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    // Один и тот же аккаунт Telegram не может быть привязан к двум людям
    uniqueIndex('auth_identities_provider_user_idx').on(table.provider, table.providerUserId),
    /*
     * И наоборот: у человека не больше одного способа входа каждого вида.
     * Иначе «какой Telegram проверять на подписку» перестаёт иметь ответ,
     * а гонка двух одновременных подключений дала бы два — и ночная сверка
     * проверяла бы случайный из них
     */
    // Заодно обслуживает поиск способов входа человека: участник стоит
    // первым, поэтому отдельный индекс по нему больше не нужен
    uniqueIndex('auth_identities_user_provider_idx').on(table.userId, table.provider),
  ],
)

export const sessions = pgTable(
  'sessions',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /**
     * В базе лежит не сам ключ сессии, а его хеш.
     * Если содержимое базы утечёт, войти по этим данным будет нельзя.
     */
    tokenHash: text('token_hash').notNull(),

    /** Для списка активных устройств в профиле */
    userAgent: text('user_agent'),
    /** IP хранится хешированным: адрес — персональные данные */
    ipHash: text('ip_hash'),

    createdAt: createdAt(),
    lastUsedAt: timestampTz('last_used_at').notNull().defaultNow(),
    expiresAt: timestampTz('expires_at').notNull(),
    revokedAt: timestampTz('revoked_at'),
  },
  (table) => [
    uniqueIndex('sessions_token_hash_idx').on(table.tokenHash),
    index('sessions_user_idx').on(table.userId),
    index('sessions_expires_idx').on(table.expiresAt),
  ],
)

/**
 * Одноразовые коды входа по почте.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ КОД ХРАНИТСЯ ХЕШЕМ, ХОТЯ ЖИВЁТ ДЕСЯТЬ МИНУТ
 *
 * Десяти минут хватает, чтобы войти под любым человеком, у которого
 * в этот момент открыт экран ввода кода, — если код можно прочитать
 * из копии базы или из журнала запросов. Хеш с секретом приложения
 * закрывает и то и другое: из строки базы код не восстановить.
 * ─────────────────────────────────────────────────────────────────
 *
 * Строка не привязана к участнику: код запрашивают и те, у кого
 * аккаунта ещё нет, — он появится при первом успешном вводе.
 *
 * Старые строки убирает ночная задача (`session-cleanup`).
 */
export const emailLoginCodes = pgTable(
  'email_login_codes',
  {
    id: primaryId(),

    /** Адрес в приведённом виде: строчные буквы, без пробелов */
    email: text('email').notNull(),
    /** HMAC кода вместе с идентификатором строки: код одной строки не подходит к другой */
    codeHash: text('code_hash').notNull(),
    /** Сколько раз код вводили неверно. На пределе код сгорает */
    attempts: integer('attempts').notNull().default(0),

    expiresAt: timestampTz('expires_at').notNull(),
    /** Код использован, сгорел или заменён новым */
    consumedAt: timestampTz('consumed_at'),

    /** С какого адреса запрошен. Хешем, как и в сессиях */
    ipHash: text('ip_hash'),

    createdAt: createdAt(),
  },
  (table) => [
    // Оба запроса модуля — «последний код этого адреса» и «сколько кодов
    // за час» — идут по адресу с сортировкой по времени
    index('email_login_codes_email_idx').on(table.email, table.createdAt),
    index('email_login_codes_expires_idx').on(table.expiresAt),
  ],
)

/**
 * Одноразовые ссылки «Подключить Telegram».
 *
 * Человек вошёл по почте, платформа выдала ему ссылку на бота вида
 * `t.me/бот?start=ключ`. Нажав «Старт», он отправляет боту этот ключ,
 * а Telegram сообщает нам, кто именно его отправил. Так связываются
 * аккаунт платформы и аккаунт Telegram без единого ввода вручную.
 *
 * В базе лежит хеш ключа: сам ключ — это право привязать свой Telegram
 * к чужому аккаунту, и восстанавливать его из копии базы нельзя.
 */
export const telegramLinkTokens = pgTable(
  'telegram_link_tokens',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    tokenHash: text('token_hash').notNull(),

    expiresAt: timestampTz('expires_at').notNull(),
    usedAt: timestampTz('used_at'),

    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('telegram_link_tokens_hash_idx').on(table.tokenHash),
    index('telegram_link_tokens_user_idx').on(table.userId),
  ],
)
