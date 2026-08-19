import { authorizeAttachmentTarget, requireAttachmentTarget } from '@/app/_lib/attachment-access'
import { getSession } from '@/modules/identity/current-user'
import { describeUpload, uploadErrors } from '@/modules/media'
import { storeMaterial } from '@/modules/media/upload-service'
import { errors, toAppError } from '@/shared/errors'
import { getLogger } from '@/shared/logger'
import { reportError } from '@/shared/observability'
import { failure, success } from '@/shared/result'
import { checkRateLimit } from '@/shared/security/rate-limit'

/**
 * Загрузка материала куратором.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ОБРАБОТЧИК АДРЕСА, А НЕ ДЕЙСТВИЕ СЕРВЕРА
 *
 * Всё остальное в проекте делается действиями сервера — они типизированы
 * от формы до базы. Здесь их не хватает по двум причинам:
 *
 *   1. У действий есть предел размера тела запроса, и поднимать его
 *      до пятидесяти мегабайт ради загрузки — значит поднять его
 *      для каждой формы в проекте.
 *   2. Действие не даёт прогресса. Куратор, отправивший двадцать
 *      мегабайт без индикатора, через пять секунд нажмёт кнопку
 *      второй раз — и получит два одинаковых таба.
 *
 * Поэтому байты идут сюда, а всё управление уже загруженным
 * (подпись, порядок, удаление) остаётся обычными действиями.
 * ─────────────────────────────────────────────────────────────────
 *
 * Формат ответа — тот же `ActionResult`, что у действий: интерфейс
 * разбирает успех и ошибку одинаково, независимо от того, каким путём
 * пришёл ответ.
 */

/** Имя файла едет заголовком: в теле запроса лежат сами байты */
const FILE_NAME_HEADER = 'x-file-name'

/**
 * Сколько загрузок разрешено одному человеку.
 *
 * Щедро: при переносе архива куратор льёт файлы пачкой. Ограничение
 * защищает не от куратора, а от кода, зациклившегося на повторной
 * отправке.
 */
const RATE_LIMIT = { limit: 60, windowSeconds: 600 }

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getSession()
    if (!session) throw errors.unauthorized()

    const actorId = session.user.id

    if (
      !checkRateLimit({ action: 'media.upload', subject: actorId, ...RATE_LIMIT }).allowed //
    ) {
      throw errors.rateLimited()
    }

    const url = new URL(request.url)
    const entityType = requireAttachmentTarget(url.searchParams.get('entityType'))
    const entityId = url.searchParams.get('entityId')

    if (!entityId) {
      throw errors.validation({ entityId: 'Не указано, к чему прикладывается материал' })
    }

    await authorizeAttachmentTarget(actorId, entityType, entityId, { requireUpload: true })

    const fileName = readFileName(request)
    const descriptor = describeUpload(fileName)

    // Вид файла определяется до чтения тела: незачем принимать
    // пятьдесят мегабайт, чтобы потом отказать по расширению
    if (!descriptor) {
      throw errors.validation({ file: uploadErrors.unsupported })
    }

    const bytes = await readBody(request, descriptor.limitBytes)

    const stored = await storeMaterial({
      entityType,
      entityId,
      fileName,
      bytes,
      uploadedBy: actorId,
    })

    return json(success(stored))
  } catch (error) {
    const appError = toAppError(error)

    if (!appError.isExpected) {
      const incidentId = reportError(appError, { action: 'media.upload' })
      getLogger().error({ err: appError, incidentId }, 'не удалось принять файл')

      return json(failure(appError, incidentId), appError.httpStatus)
    }

    return json(failure(appError), appError.httpStatus)
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

/**
 * Имя файла из заголовка.
 *
 * Закодировано в браузере: в заголовках HTTP допустима только латиница,
 * а «Nothing Else Matters — соло.pdf» латиницей не является. Без
 * раскодирования сюда приехали бы знаки процентов вместо букв.
 */
function readFileName(request: Request): string {
  const raw = request.headers.get(FILE_NAME_HEADER)
  if (!raw) throw errors.validation({ file: uploadErrors.missing })

  try {
    return decodeURIComponent(raw)
  } catch {
    throw errors.validation({ file: uploadErrors.missing })
  }
}

/**
 * Чтение тела с ограничением размера.
 *
 * Поток читается кусками и обрывается, как только превышен предел.
 * Целиком в память запрос не берётся: иначе достаточно объявить
 * заголовок и отправить пять гигабайт, чтобы уронить сервер
 * с четырьмя гигабайтами памяти.
 *
 * Заголовок с длиной проверяется первым, но доверия ему нет: он всего
 * лишь избавляет от бессмысленной пересылки, когда отправитель честен.
 */
async function readBody(request: Request, limitBytes: number): Promise<Buffer> {
  const declared = Number(request.headers.get('content-length'))

  if (Number.isFinite(declared) && declared > limitBytes) {
    throw errors.validation({ file: uploadErrors.tooLarge(limitBytes) })
  }

  const reader = request.body?.getReader()
  if (!reader) throw errors.validation({ file: uploadErrors.missing })

  const chunks: Uint8Array[] = []
  let total = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue

    total += value.byteLength

    if (total > limitBytes) {
      await reader.cancel()
      throw errors.validation({ file: uploadErrors.tooLarge(limitBytes) })
    }

    chunks.push(value)
  }

  if (total === 0) throw errors.validation({ file: uploadErrors.empty })

  return Buffer.concat(chunks)
}

/**
 * Обработчик работает в среде Node и не кэшируется.
 *
 * Оба указания обязательны: чтение потока запроса требует Node,
 * а закэшированный ответ на загрузку — это загруженный один раз файл,
 * который «загружается» и во второй, и в третий раз.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
