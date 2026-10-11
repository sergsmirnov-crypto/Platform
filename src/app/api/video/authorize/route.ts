import { timingSafeEqual } from 'node:crypto'

import { hasActiveAccess } from '@/modules/subscription'
import { serverEnv } from '@/shared/config/env.server'
import { requireSessionSecret } from '@/shared/config/secrets'
import { getLogger } from '@/shared/logger'
import { verifyPlaybackToken } from '@/shared/video'

/**
 * Разрешение на воспроизведение. Сюда обращается видеохостинг.
 *
 * ─────────────────────────────────────────────────────────────────
 * САМАЯ ВАЖНАЯ ТОЧКА ЗАЩИТЫ КОНТЕНТА
 *
 * При каждой попытке воспроизведения Kinescope спрашивает у нас: можно ли
 * этому человеку смотреть этот ролик? Без ответа «да» сервер лицензий
 * не выдаёт ключ расшифровки, и зашифрованное видео не проигрывается
 * вовсе — ни в браузере, ни в скачивалке.
 *
 * Поэтому здесь принципиально другое поведение, чем у остальной платформы:
 *
 *   • подписка проверяется по ЖИВОМУ состоянию, а не по тому, что было
 *     при открытии страницы. Кончилась в среду — видео остановилось
 *     в среду;
 *   • ключ обязан быть выдан именно на этот ролик. Подсмотреть ключ
 *     на одном разборе и подставить к другому не выйдет;
 *   • при любом сомнении отвечаем «нет». Здесь нет политики fail-open:
 *     она существует для того, чтобы недоступность Telegram не отрезала
 *     участников от оплаченного, а не для того, чтобы сомнительный запрос
 *     получил доступ.
 * ─────────────────────────────────────────────────────────────────
 *
 * Адрес этого обработчика прописывается в Kinescope один раз:
 * `pnpm kinescope:setup`. Обращения приходят ИЗ ИНТЕРНЕТА, поэтому
 * с локальной машины проверить это можно только через туннель.
 */

/** Что присылает Kinescope */
type AuthorizeRequest = {
  /** Идентификатор ролика у хостинга */
  id?: unknown
  /** Наш ключ воспроизведения — то, что мы положили в `drmauthtoken` */
  token?: unknown
  ip?: unknown
  user_agent?: unknown
  type?: unknown
}

export async function POST(request: Request): Promise<Response> {
  if (!isCallerTrusted(request)) {
    // 401, а не 403: это ошибка настройки на стороне хостинга,
    // и различать её при разборе полётов важно
    return answer(401, 'unauthorized_caller')
  }

  const payload = await readJson(request)
  if (!payload) return answer(400, 'bad_request')

  const videoId = typeof payload.id === 'string' ? payload.id : null
  const token = typeof payload.token === 'string' ? payload.token : null

  if (!videoId || !token) return answer(400, 'bad_request')

  const claims = verifyPlaybackToken(token, requireSessionSecret())

  // Ключ испорчен, подписан чужим секретом или истёк
  if (!claims) return deny(videoId, 'invalid_token')

  // Ключ выдан на другой ролик: попытка открыть чужое видео своим ключом
  if (claims.videoId !== videoId) return deny(videoId, 'video_mismatch', claims.userId)

  if (!(await hasActiveAccess(claims.userId))) {
    return deny(videoId, 'no_subscription', claims.userId)
  }

  return answer(200, 'ok')
}

/**
 * Проверка, что запрос действительно от хостинга.
 *
 * Kinescope умеет ходить к нам с обычной проверкой по логину и паролю —
 * их мы задаём сами при настройке. Без этого обработчик открыт всему
 * интернету: узнать по нему чужой ключ нельзя, но перебирать ключи
 * и нагружать базу — можно.
 *
 * Если логин и пароль не заданы, проверка не выполняется. Это осознанная
 * поблажка для местной разработки; в производственной среде настройки
 * не дадут приложению запуститься без них.
 */
function isCallerTrusted(request: Request): boolean {
  const user = serverEnv.VIDEO_AUTH_USER
  const password = serverEnv.VIDEO_AUTH_PASSWORD

  if (!user || !password) return true

  const header = request.headers.get('authorization') ?? ''
  const expected = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`

  return equalsInConstantTime(header, expected)
}

async function readJson(request: Request): Promise<AuthorizeRequest | null> {
  try {
    const parsed: unknown = await request.json()

    return typeof parsed === 'object' && parsed !== null ? (parsed as AuthorizeRequest) : null
  } catch {
    return null
  }
}

/**
 * Отказ пишется в журнал всегда.
 *
 * Это не шум: всплеск отказов означает либо сломанную настройку хостинга,
 * либо чужие попытки подобрать ключ. И то и другое нужно увидеть в тот же
 * день, а не через месяц по жалобам участников.
 */
function deny(videoId: string, reason: string, userId?: string): Response {
  getLogger().warn({ videoId, userId, reason }, 'отказано в воспроизведении')

  return answer(403, reason)
}

/**
 * Ответ нарочно бессодержательный.
 *
 * Хостингу достаточно кода: 200 — разрешить, 403 — запретить. Причина
 * отказа остаётся у нас в журнале: подсказка «ключ истёк» против «ключ
 * от другого ролика» помогает только тому, кто подбирает.
 */
function answer(status: number, reason: string): Response {
  return new Response(JSON.stringify({ reason }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

function equalsInConstantTime(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)

  if (a.length !== b.length) return false

  return timingSafeEqual(a, b)
}
