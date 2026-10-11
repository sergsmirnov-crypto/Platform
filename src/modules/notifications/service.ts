import 'server-only'

import { appConfig } from '@/shared/config/app.config'
import { getLogger } from '@/shared/logger'

import { isKnownNotificationType } from './catalog'
import {
  countUnread,
  findNotifications,
  findOptedOut,
  findPreferences,
  insertNotifications,
  markAllRead,
  purgeOldNotifications,
  upsertPreference,
} from './repository'
import { isEnabledFor, isImmediate, resolvePreferences } from './rules'

import type { NotificationType } from './catalog'
import type { ResolvedPreference } from './rules'
import type { NotificationInput, NotificationRow } from './types'

/**
 * Создание, чтение и настройки уведомлений.
 *
 * ─────────────────────────────────────────────────────────────────
 * СОЗДАНИЕ НИКОГДА НЕ ЛОМАЕТ ТО, ЧТО ЕГО ВЫЗВАЛО
 *
 * Уведомление о новом разборе создаётся при публикации. Если создание
 * упадёт — база недоступна, тип неизвестен, что угодно, — публикация
 * обязана состояться всё равно.
 *
 * Куратор нажал «Опубликовать» и получил ошибку, хотя разбор
 * опубликован, — он нажмёт ещё раз, и появится дубль. Уведомление
 * не стоит того, чтобы ради него ломать основное действие. Поэтому
 * `notifyMany` не бросает исключений, а пишет в журнал.
 * ─────────────────────────────────────────────────────────────────
 */

/**
 * Создать уведомление для нескольких человек.
 *
 * Отказавшиеся отсеиваются здесь, а не при отправке: строка, которую
 * человек всё равно не увидит и не получит, не должна появляться
 * в его ленте.
 *
 * @returns созданные уведомления — их забирает доставка
 */
export async function notifyMany(
  userIds: string[],
  input: NotificationInput,
): Promise<{ id: bigint; userId: string }[]> {
  if (userIds.length === 0) return []

  try {
    const optedOut = await findOptedOut(input.type)
    const recipients = userIds.filter((userId) => !optedOut.has(userId))

    if (recipients.length === 0) return []

    const rows = await insertNotifications(
      recipients.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        actionUrl: input.actionUrl ?? null,
      })),
    )

    getLogger().info(
      { type: input.type, created: rows.length, skipped: userIds.length - recipients.length },
      'уведомления созданы',
    )

    return rows
  } catch (error) {
    // Намеренно проглатываем: см. заголовок файла
    getLogger().error({ err: error, type: input.type }, 'не удалось создать уведомления')

    return []
  }
}

/** Создать уведомление одному человеку */
export async function notifyOne(
  userId: string,
  input: NotificationInput,
): Promise<{ id: bigint; userId: string }[]> {
  return notifyMany([userId], input)
}

/** Нужно ли отправлять этот тип немедленно, а не вечерней сводкой */
export function shouldSendImmediately(type: NotificationType): boolean {
  return isImmediate(type)
}

/** Лента человека */
export async function getFeed(userId: string): Promise<NotificationRow[]> {
  return findNotifications(userId, appConfig.notifications.feedSize)
}

export async function getUnreadCount(userId: string): Promise<number> {
  return countUnread(userId)
}

/**
 * Отметить всё прочитанным.
 *
 * Только целиком, без отметки по одному. Уведомление читают, открывая
 * то, на что оно указывает; возиться с галочками у списка новостей никто
 * не станет, а неотмечаемый счётчик раздражает.
 */
export async function markFeedRead(userId: string): Promise<void> {
  await markAllRead(userId)
}

// ─── Настройки доставки ───

export async function getPreferences(userId: string): Promise<ResolvedPreference[]> {
  return resolvePreferences(await findPreferences(userId))
}

/**
 * Изменить настройку.
 *
 * Попытка выключить неотключаемый тип молча ничего не делает: это
 * не ошибка человека, а несогласованность интерфейса с каталогом,
 * и отвечать на неё сообщением об ошибке некому.
 */
export async function setPreference(
  userId: string,
  type: string,
  enabled: boolean,
): Promise<ResolvedPreference[]> {
  if (isKnownNotificationType(type)) {
    await upsertPreference(userId, type, enabled)
  }

  return getPreferences(userId)
}

/** Хочет ли человек получать этот тип */
export async function wantsNotification(userId: string, type: NotificationType): Promise<boolean> {
  return isEnabledFor(type, await findPreferences(userId))
}

/** Уборка ленты: срок хранения задан продуктом */
export async function purgeOldFeed(): Promise<number> {
  const before = new Date(Date.now() - appConfig.notifications.retentionDays * 24 * 60 * 60 * 1000)

  return purgeOldNotifications(before)
}
