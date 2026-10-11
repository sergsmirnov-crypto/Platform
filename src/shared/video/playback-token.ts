import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto'

/**
 * Ключ воспроизведения.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЗАЧЕМ ОН НУЖЕН
 *
 * Kinescope умеет спрашивать у нас разрешение на каждое воспроизведение
 * («авторизационный бэкенд»). Чтобы он мог спросить осмысленно, ему нужно
 * передать вместе с запросом что-то, по чему мы узнаем человека. Это
 * «что-то» уезжает в браузер, в адрес плеера, — значит, оно обязано быть
 * подписанным. Иначе достаточно поправить один параметр в адресе, чтобы
 * представиться кем угодно.
 *
 * Ключ привязан к паре «человек + видео». Ключ, выданный на один разбор,
 * не открывает другой: подсмотреть чужой ключ в исходном коде страницы
 * и подставить к платному видео не выйдет.
 * ─────────────────────────────────────────────────────────────────
 *
 * **Почему свой формат, а не JWT.** В проекте уже принят этот приём:
 * ключи сессий — случайные строки, проверяемые по HMAC (`shared/security`).
 * Стандартный JWT принёс бы зависимость, разбор чужого формата и целый
 * класс ошибок вокруг выбора алгоритма подписи, не дав здесь ничего:
 * читать этот ключ, кроме нас, никто не должен.
 *
 * Формат: `payload.signature`, обе части в base64url.
 * Полезная нагрузка короткая намеренно — она едет в адресе плеера.
 */

/** Что лежит внутри ключа. Имена односимвольные: длина адреса имеет значение */
type Payload = {
  /** Кто смотрит */
  u: string
  /** Что смотрит: идентификатор ролика у видеохостинга */
  v: string
  /** До какого момента ключ действителен, в секундах эпохи */
  e: number
}

export type PlaybackClaims = {
  userId: string
  videoId: string
  expiresAt: Date
}

/**
 * Отдельный ключ подписи, выведенный из секрета приложения.
 *
 * Тот же секрет уже подписывает сессии, и использовать его напрямую
 * для второй задачи — плохая привычка: сегодня это две подписи, завтра
 * пять, и ключ воспроизведения однажды окажется принят там, где ждали
 * ключ сессии. HKDF разводит их математически: из общего секрета
 * получаются разные ключи, и один по другому не восстанавливается.
 */
function signingKey(secret: string): Buffer {
  if (!secret) {
    throw new Error('Не задан секрет для подписи ключей воспроизведения (SESSION_SECRET)')
  }

  return Buffer.from(hkdfSync('sha256', secret, '', 'video-playback', 32))
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', signingKey(secret)).update(payload).digest('base64url')
}

/**
 * Выдаёт ключ на просмотр конкретного ролика конкретным человеком.
 *
 * @param ttlSeconds сколько ключ живёт. Это не срок доступа к видео:
 *        доступ проверяется заново при каждом запросе от Kinescope,
 *        по живому состоянию подписки. Срок жизни ключа ограничивает
 *        только то, как долго можно пользоваться подсмотренной строкой
 */
export function issuePlaybackToken(
  claims: { userId: string; videoId: string },
  secret: string,
  ttlSeconds: number,
  now: Date = new Date(),
): string {
  const payload: Payload = {
    u: claims.userId,
    v: claims.videoId,
    e: Math.floor(now.getTime() / 1000) + ttlSeconds,
  }

  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')

  return `${encoded}.${sign(encoded, secret)}`
}

/**
 * Проверяет ключ и достаёт из него, кто и что смотрит.
 *
 * Возвращает `null` на любой неудаче — испорченный ключ, чужая подпись,
 * истёкший срок. Различать причины наружу не нужно: тому, кто подбирает
 * ключ, подсказка о том, что именно не сошлось, только помогает.
 */
export function verifyPlaybackToken(
  token: string,
  secret: string,
  now: Date = new Date(),
): PlaybackClaims | null {
  const separator = token.lastIndexOf('.')
  if (separator <= 0) return null

  const encoded = token.slice(0, separator)
  const signature = token.slice(separator + 1)

  const expected = sign(encoded, secret)
  if (!equalsInConstantTime(signature, expected)) return null

  const payload = parsePayload(encoded)
  if (!payload) return null

  const expiresAt = new Date(payload.e * 1000)
  if (expiresAt.getTime() <= now.getTime()) return null

  return { userId: payload.u, videoId: payload.v, expiresAt }
}

function parsePayload(encoded: string): Payload | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as Payload).u !== 'string' ||
      typeof (parsed as Payload).v !== 'string' ||
      typeof (parsed as Payload).e !== 'number'
    ) {
      return null
    }

    return parsed as Payload
  } catch {
    return null
  }
}

/**
 * Сравнение за одинаковое время.
 *
 * Обычное сравнение строк прекращается на первом несовпавшем символе,
 * и по времени ответа можно посимвольно подобрать подпись. Разница
 * измеряется микросекундами, но за тысячи попыток она становится
 * различимой.
 */
function equalsInConstantTime(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)

  if (a.length !== b.length) return false

  return timingSafeEqual(a, b)
}
