import { z } from 'zod'

/**
 * Правила блокировки участника.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЧИСТЫЕ ФУНКЦИИ, БЕЗ БАЗЫ И БЕЗ ЗАПРОСА
 *
 * Здесь только «можно или нельзя, и почему». Кто спрашивает, кого
 * блокируют и что об этом думает база — решается в сервисе.
 *
 * Причина та же, по которой отдельно живёт вычисление прав: ошибка
 * в этих четырёх условиях означает либо запертую платформу, либо
 * заблокированного владельца. Такое проверяют тестами, а не глазами.
 * ─────────────────────────────────────────────────────────────────
 */

/** Кого блокируют — ровно то, что нужно для решения */
export type ModerationTarget = {
  userId: string
  /** Владелец платформы. Его блокировать нельзя никогда */
  isOwner: boolean
  /** Уже заблокирован */
  isBlocked: boolean
}

export type ModerationVerdict = { allowed: true } | { allowed: false; reason: string }

const ALLOWED: ModerationVerdict = { allowed: true }

function deny(reason: string): ModerationVerdict {
  return { allowed: false, reason }
}

/**
 * Можно ли заблокировать этого человека.
 *
 * Три запрета, и каждый закрывает ошибку, которую иначе чинят руками
 * в базе:
 *
 *   себя      — человек выбрасывает сам себя с платформы и не может войти
 *   владельца — платформа остаётся без хозяина, права вернуть некому
 *   дважды    — повторная блокировка затёрла бы исходную причину и дату
 */
export function checkCanBlock(actorId: string, target: ModerationTarget): ModerationVerdict {
  if (actorId === target.userId) {
    return deny('Нельзя заблокировать самого себя')
  }

  if (target.isOwner) {
    return deny('Владельца платформы заблокировать нельзя')
  }

  if (target.isBlocked) {
    return deny('Участник уже заблокирован')
  }

  return ALLOWED
}

/** Снять блокировку можно только с заблокированного */
export function checkCanUnblock(target: ModerationTarget): ModerationVerdict {
  if (!target.isBlocked) {
    return deny('Участник не заблокирован')
  }

  return ALLOWED
}

/**
 * Причина блокировки.
 *
 * Нижняя граница намеренно не нулевая: пустая причина превращает журнал
 * в список дат без содержания. Верхняя — чтобы в поле не переехала
 * переписка целиком.
 */
export const MIN_BLOCK_REASON_LENGTH = 5
export const MAX_BLOCK_REASON_LENGTH = 500

export const blockReasonSchema = z
  .string()
  .trim()
  .min(MIN_BLOCK_REASON_LENGTH, 'Опишите причину: её прочитают через полгода')
  .max(MAX_BLOCK_REASON_LENGTH, 'Слишком длинно — оставьте суть')

/**
 * Что показать вместо причины, если её нет.
 *
 * Записи, сделанные до появления этого поля, и записи, у которых причину
 * стёрли вместе с автором, не должны выглядеть как пустое место.
 */
export function blockReasonLabel(reason: string | null): string {
  return reason?.trim() || 'Причина не указана'
}
