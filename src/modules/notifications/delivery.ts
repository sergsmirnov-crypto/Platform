import 'server-only'

import { findTelegramIdByUserId } from '@/modules/identity'
import { clientEnv } from '@/shared/config/env.client'
import { getLogger } from '@/shared/logger'
import { telegram } from '@/shared/telegram/client'

import { findPendingDigest, markSent } from './repository'
import { buildDigestText, isImmediate } from './rules'
import { notifyMany } from './service'

import type { NotificationType } from './catalog'
import type { PendingDigestRow } from './types'

/**
 * Доставка уведомлений в Telegram.
 *
 * ─────────────────────────────────────────────────────────────────
 * НЕДОСТАВЛЕННОЕ УВЕДОМЛЕНИЕ — НЕ ПОЛОМКА
 *
 * Человек мог заблокировать бота, удалить переписку, сменить номер,
 * жить в стране, где мессенджер закрыт. Ни один из этих случаев
 * не должен окрашивать журнал в красное и будить дежурного.
 *
 * Поэтому отправка возвращает признак успеха, а не бросает исключение,
 * и неудача остаётся предупреждением. Само уведомление при этом
 * никуда не девается: оно уже лежит в ленте на платформе, и человек
 * увидит его, когда зайдёт.
 * ─────────────────────────────────────────────────────────────────
 */

/**
 * Отправка одного сообщения.
 *
 * @returns дошло ли
 */
async function send(userId: string, text: string): Promise<boolean> {
  if (!telegram.isConfigured()) return false

  const chatId = await findTelegramIdByUserId(userId)
  if (!chatId) return false

  try {
    await telegram.sendMessage(chatId, text)

    return true
  } catch (error) {
    getLogger().warn({ err: error, userId }, 'уведомление не доставлено в Telegram')

    return false
  }
}

/** Срочное уведомление — отдельным сообщением, сразу */
export async function deliverImmediate(input: {
  notificationId: bigint
  userId: string
  type: NotificationType
  title: string
  body?: string | null
}): Promise<void> {
  if (!isImmediate(input.type)) return

  const text = [input.title, input.body, clientEnv.appUrl].filter(Boolean).join('\n\n')

  if (await send(input.userId, text)) {
    await markSent([input.notificationId])
  }
}

/**
 * Вечерняя сводка: всё накопившееся одним сообщением на человека.
 *
 * ⚠️ **Отметка об отправке ставится и тогда, когда сообщение не дошло.**
 *
 * Это выглядит неправильно, но иначе неотправленное копится вечно:
 * человек, заблокировавший бота, каждый вечер получал бы всё более
 * длинную сводку за всё время. Уведомление уже лежит в его ленте
 * на платформе — там оно и остаётся.
 *
 * @returns сколько человек получили сводку
 */
export async function deliverDigest(): Promise<{ users: number; delivered: number }> {
  // Только то, что старше минуты: свежесозданное может ещё
  // обрабатываться задачей немедленной отправки
  const pending = await findPendingDigest(new Date(Date.now() - 60_000))

  const byUser = new Map<string, PendingDigestRow[]>()

  for (const row of pending) {
    const existing = byUser.get(row.userId)
    if (existing) existing.push(row)
    else byUser.set(row.userId, [row])
  }

  let delivered = 0

  for (const [userId, rows] of byUser) {
    const text = buildDigestText(
      rows.map((row) => ({ type: row.type as NotificationType, title: row.title })),
      clientEnv.appUrl,
    )

    if (!text) continue

    if (await send(userId, text)) delivered += 1

    await markSent(rows.map((row) => row.id))
  }

  return { users: byUser.size, delivered }
}

/**
 * Создать срочное уведомление и сразу отправить.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ЭТОГО НЕТ В ОЧЕРЕДИ ЗАДАЧ
 *
 * Очередь `notification.send` была заведена ещё на Этапе 1 и осталась
 * неиспользованной. Оказалось, она не нужна: срочные уведомления
 * создают только фоновые задачи (напоминание об эфире, предупреждение
 * о подписке), а они и так выполняются в фоне. Ставить из фоновой
 * задачи задачу в ту же очередь — лишний круг без единой выгоды.
 *
 * Уведомления, которые создаёт сайт (новый разбор, запись эфира),
 * срочными не бывают: они ждут вечерней сводки. Поэтому веб-процессу
 * очередь не нужна вовсе.
 * ─────────────────────────────────────────────────────────────────
 */
export async function notifyAndDeliver(
  userIds: string[],
  input: { type: NotificationType; title: string; body?: string | null; actionUrl?: string | null },
): Promise<{ created: number; delivered: number }> {
  const rows = await notifyMany(userIds, input)

  let delivered = 0

  for (const row of rows) {
    const before = delivered
    await deliverImmediate({
      notificationId: row.id,
      userId: row.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
    })
    // deliverImmediate молчит об исходе намеренно: недоставка не поломка.
    // Для отчёта в журнале считаем попытки, а не успехи
    delivered = before + 1
  }

  return { created: rows.length, delivered }
}
