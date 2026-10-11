import 'server-only'

import { and, count, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm'

import { db } from '@/shared/db'

import { notificationPreferences, notifications } from './schema'

import type { NotificationType } from './catalog'
import type { NotificationRow, PendingDigestRow } from './types'

/**
 * Запросы уведомлений. Единственное место модуля, где есть SQL.
 */

const FIELDS = {
  id: notifications.id,
  type: notifications.type,
  title: notifications.title,
  body: notifications.body,
  actionUrl: notifications.actionUrl,
  channels: notifications.channels,
  createdAt: notifications.createdAt,
  sentAt: notifications.sentAt,
  readAt: notifications.readAt,
}

/** Лента человека, свежее сверху */
export async function findNotifications(userId: string, limit: number): Promise<NotificationRow[]> {
  return db
    .select(FIELDS)
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
}

export async function countUnread(userId: string): Promise<number> {
  const [result] = await db
    .select({ total: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))

  return result?.total ?? 0
}

export async function markAllRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
}

/**
 * Создание пачкой.
 *
 * Одна вставка на всех получателей вместо двухсот пятидесяти: разбор
 * публикуется для всего клуба сразу, и построчная вставка превратила бы
 * нажатие «Опубликовать» в несколько секунд ожидания.
 */
export async function insertNotifications(
  rows: {
    userId: string
    type: NotificationType
    title: string
    body: string | null
    actionUrl: string | null
  }[],
): Promise<{ id: bigint; userId: string }[]> {
  if (rows.length === 0) return []

  return db
    .insert(notifications)
    .values(rows.map((row) => ({ ...row, channels: ['web'] })))
    .returning({ id: notifications.id, userId: notifications.userId })
}

/** Отметка об уходе в Telegram */
export async function markSent(ids: bigint[]): Promise<void> {
  if (ids.length === 0) return

  await db
    .update(notifications)
    .set({ sentAt: new Date(), channels: ['web', 'telegram'] })
    .where(inArray(notifications.id, ids))
}

/**
 * Что накопилось для вечерней сводки.
 *
 * Берём неотправленное старше минуты: только что созданное уведомление
 * может ещё обрабатываться задачей немедленной отправки, и забирать его
 * в сводку значило бы отправить дважды.
 */
export async function findPendingDigest(before: Date): Promise<PendingDigestRow[]> {
  return db
    .select({
      id: notifications.id,
      userId: notifications.userId,
      type: notifications.type,
      title: notifications.title,
    })
    .from(notifications)
    .where(and(isNull(notifications.sentAt), lt(notifications.createdAt, before)))
    .orderBy(notifications.userId, notifications.createdAt)
}

/** Уборка ленты: старое никто не листает, а место занимает */
export async function purgeOldNotifications(before: Date): Promise<number> {
  const removed = await db
    .delete(notifications)
    .where(lt(notifications.createdAt, before))
    .returning({ id: notifications.id })

  return removed.length
}

// ─── Настройки доставки ───

export async function findPreferences(
  userId: string,
): Promise<{ type: string; enabled: boolean }[]> {
  return db
    .select({ type: notificationPreferences.type, enabled: notificationPreferences.enabled })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
}

/**
 * Кого не устраивает этот тип.
 *
 * Спрашиваем отказавшихся, а не согласившихся: согласие — это отсутствие
 * строки, и получить «всех, у кого нет записи» одним запросом нельзя.
 */
export async function findOptedOut(type: NotificationType): Promise<Set<string>> {
  const rows = await db
    .select({ userId: notificationPreferences.userId })
    .from(notificationPreferences)
    .where(and(eq(notificationPreferences.type, type), eq(notificationPreferences.enabled, false)))

  return new Set(rows.map((row) => row.userId))
}

export async function upsertPreference(
  userId: string,
  type: NotificationType,
  enabled: boolean,
): Promise<void> {
  await db
    .insert(notificationPreferences)
    .values({ userId, type, enabled })
    .onConflictDoUpdate({
      target: [notificationPreferences.userId, notificationPreferences.type],
      set: { enabled: sql`excluded.enabled` },
    })
}
