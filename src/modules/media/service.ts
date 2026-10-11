import 'server-only'

import { requirePermission } from '@/modules/access'
import { hasActiveAccess } from '@/modules/subscription'
import { appConfig } from '@/shared/config/app.config'
import { requireSessionSecret } from '@/shared/config/secrets'
import { errors } from '@/shared/errors'
import { getLogger } from '@/shared/logger'
import { getStorage } from '@/shared/storage'
import { getVideoProvider, issuePlaybackToken } from '@/shared/video'

import { canDownload, canViewInline, isReady, materialTitle } from './domain'
import { buildChapters, PLAYBACK_TOKEN_TTL_SECONDS, watermarkText } from './playback'
import {
  countFailedAssets,
  findAssetById,
  findVideoAssetByExternalId,
  insertVideoAsset,
} from './repository'

import type { ChapterSource } from './playback'
import type { DownloadTicket, PlaybackTicket } from './types'

/**
 * Выдача файлов участникам.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЕДИНСТВЕННАЯ ДВЕРЬ К ЗАКРЫТЫМ ФАЙЛАМ
 *
 * Постоянных адресов у табов не существует: файл лежит в закрытой
 * части хранилища, и открыть его можно только по ссылке, подписанной
 * здесь после трёх проверок — есть ли такой файл, обработан ли он
 * и оплачена ли подписка у того, кто просит.
 *
 * Отсюда следует правило: **ключ хранилища наружу не уходит никогда.**
 * Ни в разметке страницы, ни в ответе — только готовая ссылка
 * с коротким сроком жизни. Иначе пересылка ссылки в чужой чат снова
 * стала бы возможной, а вместе с ней и весь смысл закрытой платформы
 * (PRD v0.2 §2.1).
 * ─────────────────────────────────────────────────────────────────
 *
 * Проверки прав куратора здесь нет намеренно: материал закрыт
 * подпиской, а не ролью. Куратор — такой же участник, и его доступ
 * к чужим табам определяется тем же условием.
 */

/**
 * Ссылка на скачивание материала.
 *
 * Бросает понятную ошибку вместо тихого `null`: каждая причина отказа
 * требует своего ответа человеку — «войдите», «продлите подписку»,
 * «файл ещё обрабатывается».
 */
/**
 * Разрешение показать материал в браузере (шаг 10.6).
 *
 * ─────────────────────────────────────────────────────────────────
 * ОТДЕЛЬНАЯ ФУНКЦИЯ, А НЕ ПРИЗНАК У СКАЧИВАНИЯ
 *
 * Проверки почти те же, но не совсем: показать можно только PDF
 * и картинку, а скачать — ещё и Guitar Pro с минусовкой. Признак
 * `inline` у скачивания означал бы, что однажды кто-то передаст его
 * для файла Guitar Pro и получит ссылку, по которой браузер покажет
 * пустой экран.
 * ─────────────────────────────────────────────────────────────────
 */
export async function getViewTicket(userId: string, assetId: string): Promise<DownloadTicket> {
  const asset = await findAssetById(assetId)

  if (!asset) throw errors.notFound('Материал не найден')

  if (!canViewInline(asset.kind)) {
    throw errors.forbidden('Этот материал нельзя показать в браузере')
  }

  if (!isReady(asset.processingStatus)) {
    throw errors.conflict('Файл ещё обрабатывается. Попробуйте через минуту')
  }

  if (!(await hasActiveAccess(userId))) throw errors.subscriptionRequired()

  const key = asset.externalId
  if (!key) throw errors.internal(new Error(`У материала ${asset.id} не заполнен ключ хранилища`))

  const fileName = downloadFileName(materialTitle(asset.title, asset.kind), key)
  const expiresInSeconds = appConfig.media.downloadUrlTtlMinutes * 60

  const url = await getStorage().getSignedUrl(key, expiresInSeconds, {
    downloadName: fileName,
    inline: true,
  })

  return { url, fileName, expiresInSeconds }
}

export async function getDownloadTicket(userId: string, assetId: string): Promise<DownloadTicket> {
  const asset = await findAssetById(assetId)

  if (!asset) {
    throw errors.notFound('Материал не найден')
  }

  // Видео сюда не попадает никогда: оно отдаётся видеохостингом,
  // а не нашим хранилищем, и скачиваться не должно (шаг 5.4)
  if (!canDownload(asset)) {
    throw errors.forbidden('Этот материал скачивать нельзя')
  }

  if (!isReady(asset.processingStatus)) {
    throw errors.conflict('Файл ещё обрабатывается. Попробуйте через минуту')
  }

  if (!(await hasActiveAccess(userId))) {
    throw errors.subscriptionRequired()
  }

  // Ключ объекта хранится в поле идентификатора у поставщика: для своего
  // хранилища «идентификатор файла» — это и есть путь к нему
  const key = asset.externalId
  if (!key) {
    // Запись есть, файла нет — это поломка, а не поворот сценария
    throw errors.internal(new Error(`У материала ${asset.id} не заполнен ключ хранилища`))
  }

  const expiresInSeconds = appConfig.media.downloadUrlTtlMinutes * 60
  const fileName = downloadFileName(materialTitle(asset.title, asset.kind), key)

  const url = await getStorage().getSignedUrl(key, expiresInSeconds, { downloadName: fileName })

  getLogger().info({ userId, assetId: asset.id, kind: asset.kind }, 'выдана ссылка на материал')

  return { url, fileName, expiresInSeconds }
}

/**
 * Имя, под которым файл сохранится у человека.
 *
 * Собирается из подписи материала и расширения из ключа хранилища.
 * Брать имя целиком из ключа нельзя: там лежит `a3f21c-1.pdf`,
 * и пять скачанных табов становятся неразличимы. Брать одну подпись
 * тоже нельзя: без расширения система не поймёт, чем открывать файл.
 */
function downloadFileName(title: string, key: string): string {
  const extension = key.includes('.') ? key.slice(key.lastIndexOf('.')) : ''

  // Символы, недопустимые в именах файлов Windows и macOS. Косая черта
  // особенно: имя с ней уводит сохранение в другую папку
  const safeTitle = title.replace(/[\\/:*?"<>|]+/g, ' ').trim()

  return `${safeTitle || 'material'}${extension}`
}

/**
 * Разрешение на просмотр видео.
 *
 * ─────────────────────────────────────────────────────────────────
 * ЧТО ЗДЕСЬ ПРОИСХОДИТ
 *
 * Мы НЕ отдаём ссылку на видеофайл — её не существует. Мы собираем адрес
 * плеера и вкладываем в него подписанный ключ, по которому видеохостинг
 * потом сам спросит у нас разрешение (см. `/api/video/authorize`).
 *
 * То есть проверка подписки здесь — предварительная, «чтобы не показывать
 * плеер тому, кому нечего смотреть». Настоящая проверка происходит позже,
 * в момент воспроизведения, и по живому состоянию подписки. Это важная
 * разница: подписка, кончившаяся после открытия страницы, остановит видео,
 * а не доиграет его до конца.
 * ─────────────────────────────────────────────────────────────────
 */
export async function getPlaybackTicket(
  viewer: { id: string; displayName: string; username?: string | null },
  input: { assetId: string; startSec: number | null; chapters: ChapterSource[] },
): Promise<PlaybackTicket | null> {
  const asset = await findAssetById(input.assetId)

  if (!asset || asset.kind !== 'video') return null
  if (!isReady(asset.processingStatus)) return null

  if (!(await hasActiveAccess(viewer.id))) {
    throw errors.subscriptionRequired()
  }

  const videoId = asset.externalId
  if (!videoId) {
    throw errors.internal(new Error(`У ролика ${asset.id} не заполнен идентификатор у хостинга`))
  }

  const token = issuePlaybackToken(
    { userId: viewer.id, videoId },
    requireSessionSecret(),
    PLAYBACK_TOKEN_TTL_SECONDS,
  )

  const source = getVideoProvider().buildSource({
    videoId,
    token,
    watermark: watermarkText(viewer),
    chapters: buildChapters(input.chapters),
    startSec: input.startSec,
  })

  return {
    url: source.url,
    watermark: source.watermark,
    chapters: source.chapters,
    startSec: source.startSec,
  }
}

/**
 * Привязка ролика, загруженного в панели видеохостинга.
 *
 * ─────────────────────────────────────────────────────────────────
 * ПОЧЕМУ ПОКА ИДЕНТИФИКАТОР, А НЕ ЗАГРУЗКА ИЗ БРАУЗЕРА
 *
 * Загрузка часового видео из формы — это возобновляемая передача,
 * прогресс, обработка отвалившейся сети и очередь на стороне сервера.
 * Отдельная работа, и делать её наспех внутри редактора значит получить
 * загрузку, которая срывается на сороковой минуте без объяснений.
 *
 * До тех пор куратор загружает ролик в панели хостинга — привычным ему
 * способом — и вставляет сюда идентификатор. Это две минуты вместо
 * одной, но работает надёжно и доступно сразу.
 * ─────────────────────────────────────────────────────────────────
 *
 * Запись в реестре создаётся один раз на ролик: повторная привязка того же
 * идентификатора возвращает существующую, иначе один ролик, вставленный
 * в два варианта разбора, размножился бы записями.
 */
export async function linkExternalVideo(
  externalId: string,
  uploadedBy: string,
  title: string | null,
): Promise<string> {
  const trimmed = externalId.trim()

  if (!trimmed) {
    throw errors.validation({ videoId: 'Укажите идентификатор ролика' })
  }

  const existing = await findVideoAssetByExternalId(trimmed)
  if (existing) return existing

  return insertVideoAsset({
    externalId: trimmed,
    provider: getVideoProvider().name === 'kinescope' ? 'kinescope' : 'external',
    title,
    uploadedBy,
  })
}

/**
 * Сколько файлов не доехали (шаг 9.7).
 *
 * Право `media.view_all`: это состояние всей медиатеки, а не своего
 * содержимого.
 */
export async function getFailedAssetCount(actorId: string): Promise<number> {
  await requirePermission(actorId, 'media.view_all')

  return countFailedAssets()
}
