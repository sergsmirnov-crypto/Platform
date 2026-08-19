import { errors } from '@/shared/errors'

/**
 * Ограничение частоты запросов.
 *
 * Защищает вход и другие чувствительные действия от перебора.
 *
 * Счётчики хранятся в памяти процесса. Для 250 участников и одного сервера
 * этого достаточно: отдельное хранилище вроде Redis добавило бы целый сервис,
 * который надо поднимать, обновлять и чинить, ради задачи, которая решается
 * тридцатью строками.
 *
 * Ограничение назову честно: при перезапуске приложения счётчики обнуляются,
 * а при появлении второго сервера они перестанут быть общими. К моменту,
 * когда это станет важно, нагрузка вырастет настолько, что переезд
 * в общее хранилище будет оправдан. Сейчас — преждевременно.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

/** Чтобы память не росла бесконечно, изредка выбрасываем истёкшие записи */
function sweep(now: number): void {
  if (buckets.size < 1000) return
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export type RateLimitOptions = {
  /** Что ограничиваем: 'login', 'search'. Входит в ключ */
  action: string
  /** Кого ограничиваем: идентификатор человека или хеш адреса */
  subject: string
  /** Сколько попыток разрешено */
  limit: number
  /** За какое окно времени, в секундах */
  windowSeconds: number
}

export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: number }

export function checkRateLimit(options: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  sweep(now)

  const key = `${options.action}:${options.subject}`
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + options.windowSeconds * 1000 }
    buckets.set(key, bucket)
    return { allowed: true, remaining: options.limit - 1, resetAt: bucket.resetAt }
  }

  existing.count += 1
  const allowed = existing.count <= options.limit

  return {
    allowed,
    remaining: Math.max(0, options.limit - existing.count),
    resetAt: existing.resetAt,
  }
}

/** То же самое, но сразу выбрасывает ошибку при превышении */
export function enforceRateLimit(options: RateLimitOptions): void {
  if (!checkRateLimit(options).allowed) {
    throw errors.rateLimited()
  }
}

/** Только для тестов: сбросить все счётчики */
export function resetRateLimits(): void {
  buckets.clear()
}
