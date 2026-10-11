import 'server-only'

import { and, desc, eq, gt, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'

import { db } from '@/shared/db'

import { avatarUrlFor } from './avatar-url'
import { ONBOARDING_STEP_COUNT } from './onboarding'
import { authIdentities, sessions, users } from './schema'

import type { UserProfile } from './profile'
import type { SessionForLimit } from './session-policy'
import type { SessionUser } from './types'

/**
 * Запросы к базе, связанные с людьми и сессиями.
 *
 * Единственное место в модуле, где есть SQL. Сервис работает с уже
 * полученными данными и ничего не знает о таблицах — благодаря этому
 * логику можно менять, не трогая запросы, и наоборот.
 */

/** Сессия вместе с человеком, которому она принадлежит: один запрос вместо двух */
export type SessionWithUser = {
  id: string
  userId: string
  createdAt: Date
  lastUsedAt: Date
  expiresAt: Date
  revokedAt: Date | null
  user: SessionUser
}

export async function findSessionByTokenHash(tokenHash: string): Promise<SessionWithUser | null> {
  const rows = await db
    .select({
      id: sessions.id,
      userId: sessions.userId,
      createdAt: sessions.createdAt,
      lastUsedAt: sessions.lastUsedAt,
      expiresAt: sessions.expiresAt,
      revokedAt: sessions.revokedAt,
      userDisplayName: users.displayName,
      userAvatarId: users.avatarId,
      userOnboardingDoneAt: users.onboardingDoneAt,
      userDeletedAt: users.deletedAt,
      userBlockedAt: users.blockedAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  // Удалённый участник не должен входить по старой сессии
  if (row.userDeletedAt !== null) return null

  /*
   * Заблокированный — тоже.
   *
   * Проверка здесь, а не только при блокировке, намеренно: сессии
   * при блокировке закрываются, но это две операции, и между ними
   * возможен сбой. Условие в самом низком слое переживёт и сбой,
   * и того, кто однажды напишет отзыв блокировки без закрытия сессий.
   */
  if (row.userBlockedAt !== null) return null

  return {
    id: row.id,
    userId: row.userId,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    user: {
      id: row.userId,
      displayName: row.userDisplayName,
      avatarUrl: avatarUrlFor(row.userId, row.userAvatarId, 'sm'),
      onboardingDoneAt: row.userOnboardingDoneAt,
    },
  }
}

export type CreateSessionInput = {
  userId: string
  tokenHash: string
  expiresAt: Date
  userAgent: string | null
  ipHash: string | null
}

export async function insertSession(input: CreateSessionInput): Promise<string> {
  const id = uuidv7()

  await db.insert(sessions).values({
    id,
    userId: input.userId,
    tokenHash: input.tokenHash,
    expiresAt: input.expiresAt,
    userAgent: input.userAgent,
    ipHash: input.ipHash,
  })

  return id
}

/** Продлевает срок сессии и отмечает момент последнего использования */
export async function touchSession(sessionId: string, expiresAt: Date): Promise<void> {
  await db
    .update(sessions)
    .set({ lastUsedAt: new Date(), expiresAt })
    .where(eq(sessions.id, sessionId))
}

/** Действующие сессии человека — для списка устройств и проверки лимита */
export async function findActiveSessions(userId: string): Promise<SessionForLimit[]> {
  const rows = await db
    .select({ id: sessions.id, lastUsedAt: sessions.lastUsedAt })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(sessions.lastUsedAt))

  return rows
}

/** Подробности о действующих сессиях — для экрана настроек */
export async function findActiveSessionDetails(userId: string) {
  return db
    .select({
      id: sessions.id,
      userAgent: sessions.userAgent,
      createdAt: sessions.createdAt,
      lastUsedAt: sessions.lastUsedAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(sessions.lastUsedAt))
}

/**
 * Закрывает сессии.
 *
 * Записи не удаляются, а помечаются отозванными: так в журнале остаётся след
 * того, что вход был, и можно разобрать спорный случай.
 */
export async function revokeSessions(sessionIds: readonly string[]): Promise<void> {
  if (sessionIds.length === 0) return

  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(inArray(sessions.id, [...sessionIds]), isNull(sessions.revokedAt)))
}

/** Закрывает все сессии человека. Используется при снятии доступа */
export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
  const conditions = [eq(sessions.userId, userId), isNull(sessions.revokedAt)]

  // «Выйти на всех остальных устройствах»: текущая сессия остаётся живой
  if (exceptSessionId) {
    conditions.push(ne(sessions.id, exceptSessionId))
  }

  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(...conditions))
}

/**
 * Убирает из базы давно закрытые и просроченные сессии.
 *
 * Запускается фоновой задачей. Без уборки таблица растёт вечно:
 * за год у 250 участников накопятся десятки тысяч мёртвых записей.
 */
export async function deleteStaleSessions(before: Date): Promise<number> {
  const removed = await db
    .delete(sessions)
    .where(or(lt(sessions.expiresAt, before), lt(sessions.revokedAt, before)))
    .returning({ id: sessions.id })

  return removed.length
}

/** Человек по идентификатору. Удалённые не возвращаются */
export async function findUserById(userId: string): Promise<SessionUser | null> {
  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      avatarId: users.avatarId,
      onboardingDoneAt: users.onboardingDoneAt,
    })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  return { ...row, avatarUrl: avatarUrlFor(row.id, row.avatarId, 'sm') }
}

/** Отмечает, что человек заходил. Используется для статистики активности */
export async function touchUserLastSeen(userId: string): Promise<void> {
  await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, userId))
}

/**
 * Все участники — только для служебного входа при разработке.
 * В производственной сборке эта функция не вызывается.
 */
export async function findAllUsersForDevelopment(): Promise<SessionUser[]> {
  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      avatarId: users.avatarId,
      onboardingDoneAt: users.onboardingDoneAt,
    })
    .from(users)
    .where(isNull(users.deletedAt))
    .orderBy(users.createdAt)
    .limit(50)

  return rows.map((row) => ({ ...row, avatarUrl: avatarUrlFor(row.id, row.avatarId, 'sm') }))
}

/** Способ входа вместе с человеком, которому он принадлежит */
export type IdentityWithUser = {
  userId: string
  user: SessionUser
  /** Заблокирован ли участник: вход ему закрыт (см. `telegram-login.ts`) */
  isBlocked: boolean
}

/** Ищет человека по его идентификатору в Telegram */
export async function findUserByTelegramId(telegramId: string): Promise<IdentityWithUser | null> {
  const rows = await db
    .select({
      userId: users.id,
      displayName: users.displayName,
      avatarId: users.avatarId,
      onboardingDoneAt: users.onboardingDoneAt,
      deletedAt: users.deletedAt,
      blockedAt: users.blockedAt,
    })
    .from(authIdentities)
    .innerJoin(users, eq(users.id, authIdentities.userId))
    .where(
      and(eq(authIdentities.provider, 'telegram'), eq(authIdentities.providerUserId, telegramId)),
    )
    .limit(1)

  const row = rows[0]
  if (!row || row.deletedAt !== null) return null

  return {
    userId: row.userId,
    user: {
      id: row.userId,
      displayName: row.displayName,
      avatarUrl: avatarUrlFor(row.userId, row.avatarId, 'sm'),
      onboardingDoneAt: row.onboardingDoneAt,
    },
    isBlocked: row.blockedAt !== null,
  }
}

/**
 * Сведения о человеке из Telegram.
 *
 * Фотографии здесь нет намеренно. Ссылка на снимок из Telegram живёт
 * на их серверах: она протухает, а при недоступности мессенджера
 * перестаёт открываться — ровно вопреки главному принципу платформы
 * (ARCHITECTURE §1). Фотографию участник загружает сам; исходная ссылка
 * остаётся в `providerData` как справочные сведения для поддержки.
 */
export type TelegramProfile = {
  telegramId: string
  displayName: string
  /** Всё, что прислал Telegram: имя пользователя, фамилия, ссылка на фото */
  providerData: Record<string, unknown>
}

/**
 * Создаёт участника вместе со способом входа.
 *
 * Обе записи создаются в одной транзакции: человек без способа войти
 * или способ входа без человека — это сломанное состояние, которое
 * потом придётся чинить руками.
 */
export async function createUserWithTelegramIdentity(
  profile: TelegramProfile,
): Promise<IdentityWithUser> {
  const userId = uuidv7()

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id: userId,
      displayName: profile.displayName,
      lastSeenAt: new Date(),
    })

    await tx.insert(authIdentities).values({
      id: uuidv7(),
      userId,
      provider: 'telegram',
      providerUserId: profile.telegramId,
      providerData: profile.providerData,
      isPrimary: true,
      verifiedAt: new Date(),
    })
  })

  return {
    userId,
    user: {
      id: userId,
      displayName: profile.displayName,
      avatarUrl: null,
      onboardingDoneAt: null,
    },
    // Только что созданный участник заблокированным быть не может
    isBlocked: false,
  }
}

/**
 * Обновляет сведения, пришедшие от Telegram.
 *
 * Имя и фотография участника платформы НЕ перезаписываются: человек мог
 * поменять их у нас осознанно, и затирать это при каждом входе неправильно.
 * Обновляется только копия данных поставщика — она нужна для поддержки
 * и для поиска участника по имени пользователя в Telegram.
 */
export async function updateTelegramIdentityData(
  telegramId: string,
  providerData: Record<string, unknown>,
): Promise<void> {
  await db
    .update(authIdentities)
    .set({ providerData, updatedAt: new Date() })
    .where(
      and(eq(authIdentities.provider, 'telegram'), eq(authIdentities.providerUserId, telegramId)),
    )
}

/** Идентификатор Telegram по идентификатору участника. Нужен для сверки подписок */
export async function findTelegramIdByUserId(userId: string): Promise<string | null> {
  const rows = await db
    .select({ providerUserId: authIdentities.providerUserId })
    .from(authIdentities)
    .where(and(eq(authIdentities.userId, userId), eq(authIdentities.provider, 'telegram')))
    .limit(1)

  return rows[0]?.providerUserId ?? null
}

export async function findProfile(userId: string): Promise<UserProfile | null> {
  const [row] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      avatarId: users.avatarId,
      city: users.city,
      bio: users.bio,
      playingSince: users.playingSince,
      skillLevel: users.skillLevel,
      favoriteArtists: users.favoriteArtists,
      favoriteGenres: users.favoriteGenres,
      socials: users.socials,
    })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1)

  if (!row) return null

  // Своя страница показывает фотографию крупно, поэтому здесь берётся
  // большой размер, а не тот, что нужен шапке
  const { avatarId, ...profile } = row

  return { ...profile, avatarUrl: avatarUrlFor(row.id, avatarId, 'lg') }
}

/** Какая фотография сейчас у участника. Нужно, чтобы убрать прежние файлы */
export async function findAvatarId(userId: string): Promise<string | null> {
  const rows = await db
    .select({ avatarId: users.avatarId })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1)

  return rows[0]?.avatarId ?? null
}

/** Записывает новую фотографию или убирает её (`null`) */
export async function updateAvatarId(userId: string, avatarId: string | null): Promise<void> {
  await db
    .update(users)
    .set({
      avatarId,
      avatarUpdatedAt: avatarId ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
}

export async function updateProfile(
  userId: string,
  data: Omit<UserProfile, 'id' | 'avatarUrl'>,
): Promise<void> {
  await db
    .update(users)
    .set({
      displayName: data.displayName,
      city: data.city,
      bio: data.bio,
      playingSince: data.playingSince,
      skillLevel: data.skillLevel,
      favoriteArtists: data.favoriteArtists,
      favoriteGenres: data.favoriteGenres,
      socials: data.socials,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
}

/**
 * Видимость визитки.
 *
 * Отдельным запросом, а не полем в общем сохранении профиля: это
 * согласие человека, а не сведение о нём. Оно меняется одним
 * переключателем, из другого места и в другой момент — и записывается
 * тоже отдельно, чтобы случайное сохранение формы профиля не могло
 * молча раскрыть визитку.
 */
export async function updateProfileVisibility(
  userId: string,
  visibility: 'private' | 'club',
): Promise<void> {
  await db
    .update(users)
    .set({ profileVisibility: visibility, updatedAt: new Date() })
    .where(eq(users.id, userId))
}

/** Открыта ли визитка этого человека */
export async function findProfileVisibility(userId: string): Promise<'private' | 'club'> {
  const [row] = await db
    .select({ visibility: users.profileVisibility })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  return row?.visibility ?? 'private'
}

/**
 * Обезличивает участника и помечает его удалённым.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ НЕ `DELETE FROM users`
 *
 * На запись участника ссылаются журнал действий, история подписки,
 * а позже — прогресс и заметки. Физическое удаление либо разрушило бы
 * эти связи, либо потребовало бы удалить вместе с человеком всю историю
 * платформы, включая записи о действиях других людей.
 *
 * Но и «пометить удалённым, оставив всё как было» неприемлемо: это
 * не удаление, а сокрытие, и требованию об удалении персональных данных
 * оно не отвечает.
 *
 * Поэтому здесь и то и другое: личные сведения затираются по-настоящему,
 * а строка остаётся якорем для связей. Восстановить по ней человека
 * нельзя — способ входа удаляется отдельным запросом рядом.
 * ─────────────────────────────────────────────────────────────────
 */
export async function anonymizeUser(userId: string, displayName: string): Promise<void> {
  await db
    .update(users)
    .set({
      displayName,
      avatarId: null,
      avatarUpdatedAt: null,
      city: null,
      bio: null,
      playingSince: null,
      skillLevel: null,
      socials: {},
      goals: [],
      favoriteArtists: [],
      favoriteGenres: [],
      settings: {},
      // Визитка закрывается вместе с удалением аккаунта. Условие
      // видимости и так отсекает удалённых, но оставлять согласие
      // включённым у человека, который ушёл, неправильно
      profileVisibility: 'private',
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
}

/**
 * Убирает все способы входа.
 *
 * После этого войти под прежним аккаунтом невозможно, а идентификатор
 * Telegram освобождается: вернувшись в клуб, человек получит чистый
 * новый аккаунт, а не воскресший старый.
 */
export async function deleteAuthIdentities(userId: string): Promise<void> {
  await db.delete(authIdentities).where(eq(authIdentities.userId, userId))
}

/**
 * Псевдоним человека в Telegram.
 *
 * Лежит в данных способа входа, а не в самом профиле: это свойство
 * учётной записи Telegram, и меняется оно там же. Дублировать его
 * в профиль значило бы однажды разойтись с действительностью.
 *
 * Нужен водяному знаку на видео: имена в клубе повторяются, а по
 * псевдониму источник утечки находится за секунды.
 */
export async function findTelegramUsername(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ data: authIdentities.providerData })
    .from(authIdentities)
    .where(and(eq(authIdentities.userId, userId), eq(authIdentities.provider, 'telegram')))
    .limit(1)

  const username = row?.data?.username

  return typeof username === 'string' && username.trim() ? username : null
}

/**
 * Сохранение ответов знакомства.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ОТДЕЛЬНЫЕ ФУНКЦИИ, А НЕ `updateProfile`
 *
 * Соблазн — вызывать на каждом шаге общее сохранение профиля. Но оно
 * записывает все поля сразу, а знакомство сохраняет по два поля за раз:
 * шаг с жанрами затёр бы имя, только что введённое на предыдущем шаге,
 * значением из формы, которой на экране нет.
 *
 * Отсюда правило: шаг записывает ровно свои поля и продвигает номер шага
 * одним запросом. Одним — чтобы не возникло состояния «ответ сохранён,
 * а шаг не сдвинулся»: человек увидел бы тот же вопрос второй раз.
 * ─────────────────────────────────────────────────────────────────
 *
 * `greatest` в SQL нужен из-за возможности вернуться назад: поправив ответ
 * на втором шаге, человек не должен потерять достигнутый пятый.
 */
async function advanceStep(
  userId: string,
  reachedStep: number,
  patch: Partial<typeof users.$inferInsert>,
) {
  await db
    .update(users)
    .set({
      ...patch,
      onboardingStep: sql`greatest(${users.onboardingStep}, ${reachedStep})`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
}

export async function saveOnboardingName(
  userId: string,
  reachedStep: number,
  data: { displayName: string; city: string | null },
): Promise<void> {
  await advanceStep(userId, reachedStep, { displayName: data.displayName, city: data.city })
}

export async function saveOnboardingLevel(
  userId: string,
  reachedStep: number,
  data: {
    playingSince: number | null
    skillLevel: 'beginner' | 'intermediate' | 'advanced' | null
  },
): Promise<void> {
  await advanceStep(userId, reachedStep, {
    playingSince: data.playingSince,
    skillLevel: data.skillLevel,
  })
}

export async function saveOnboardingTaste(
  userId: string,
  reachedStep: number,
  data: { favoriteArtists: string[]; favoriteGenres: string[] },
): Promise<void> {
  await advanceStep(userId, reachedStep, {
    favoriteArtists: data.favoriteArtists,
    favoriteGenres: data.favoriteGenres,
  })
}

export async function saveOnboardingGoals(
  userId: string,
  reachedStep: number,
  data: { goals: string[] },
): Promise<void> {
  await advanceStep(userId, reachedStep, { goals: data.goals })
}

/** Продвижение шага без изменения данных: человек нажал «Пропустить» */
export async function skipOnboardingStep(userId: string, reachedStep: number): Promise<void> {
  await advanceStep(userId, reachedStep, {})
}

/**
 * Отметка о завершении знакомства.
 *
 * Ставится один раз: повторный проход не должен сдвигать дату, иначе
 * в карточке участника «знакомство пройдено в марте» превратится
 * в сегодняшнее число при первом же возврате назад по шагам.
 */
export async function finishOnboarding(userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      onboardingStep: ONBOARDING_STEP_COUNT - 1,
      onboardingDoneAt: sql`coalesce(${users.onboardingDoneAt}, now())`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
}

/**
 * Ответы знакомства для подбора первого разбора и для возобновления.
 */
export type OnboardingState = {
  displayName: string
  city: string | null
  playingSince: number | null
  skillLevel: 'beginner' | 'intermediate' | 'advanced' | null
  favoriteArtists: string[]
  favoriteGenres: string[]
  goals: string[]
  onboardingStep: number
  onboardingDoneAt: Date | null
}

export async function findOnboardingState(userId: string): Promise<OnboardingState | null> {
  const [row] = await db
    .select({
      displayName: users.displayName,
      city: users.city,
      playingSince: users.playingSince,
      skillLevel: users.skillLevel,
      favoriteArtists: users.favoriteArtists,
      favoriteGenres: users.favoriteGenres,
      goals: users.goals,
      onboardingStep: users.onboardingStep,
      onboardingDoneAt: users.onboardingDoneAt,
    })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1)

  return row ?? null
}

/**
 * Личные отметки участника, не являющиеся настройками.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ В `settings`, А НЕ ОТДЕЛЬНОЙ ТАБЛИЦЕЙ
 *
 * Списку «Освойся в клубе» нужны два признака, которых больше неоткуда
 * взять: заглядывал ли человек в чат клуба и не скрыл ли он список.
 * Оба — состояние интерфейса одного участника, а не сведения о предметной
 * области.
 *
 * Заводить таблицу ради двух отметок, которые читаются только вместе
 * с самим участником и никогда самостоятельно, значило бы добавить
 * соединение на каждое открытие главной ради нормализации, ничего
 * не дающей. Когда появится журнал действий участника (`activity_events`
 * из замысла v2), отметка о чате переедет туда естественным образом.
 *
 * Плата: значения не типизированы базой. Поэтому обращение к ним идёт
 * только через эти две функции и известный список ключей — россыпь
 * `settings.something` по коду быстро стала бы свалкой.
 * ─────────────────────────────────────────────────────────────────
 */
export const USER_FLAGS = {
  /** Когда человек впервые нажал карточку перехода в чат клуба */
  chatOpenedAt: 'checklist.chatOpenedAt',
  /** Когда человек скрыл список «Освойся в клубе» */
  checklistHiddenAt: 'checklist.hiddenAt',
} as const

export type UserFlag = (typeof USER_FLAGS)[keyof typeof USER_FLAGS]

export async function findUserFlags(userId: string): Promise<Record<string, unknown>> {
  const [row] = await db
    .select({ settings: users.settings })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1)

  return row?.settings ?? {}
}

/**
 * Ставит отметку, не затирая остальные.
 *
 * Слияние делает база (`||`), а не приложение: чтение с последующей
 * записью потеряло бы отметку, поставленную в соседней вкладке между
 * этими двумя действиями.
 */
export async function setUserFlag(userId: string, flag: UserFlag, value: unknown): Promise<void> {
  await db
    .update(users)
    .set({
      settings: sql`${users.settings} || ${JSON.stringify({ [flag]: value })}::jsonb`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
}
