import { bigint, boolean, index, integer, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core'

import { users } from '@/modules/identity/schema'
import { createdAt, primaryId, updatedAt } from '@/shared/db/columns'
import { contentEntityEnum } from '@/shared/db/enums'

/**
 * Реестр всех файлов и видео.
 *
 * Смысл отдельной таблицы вместо ссылки строкой в каждом месте:
 * одно видео может использоваться в нескольких разборах, у файла есть
 * состояние обработки, а поставщик видеохостинга может смениться.
 * Переезд с одного хостинга на другой при такой схеме не требует
 * переделки контента — меняется значение в колонке `provider`.
 */

export const mediaKindEnum = pgEnum('media_kind', [
  'video',
  'pdf',
  'guitar_pro',
  'audio',
  'image',
  'interactive_tab',
  'other',
])

export const mediaProviderEnum = pgEnum('media_provider', [
  'bunny',
  'kinescope',
  's3',
  'soundslice',
  'external',
])

export const mediaProcessingStatusEnum = pgEnum('media_processing_status', [
  'uploading',
  'processing',
  'ready',
  'failed',
])

export const mediaAssets = pgTable(
  'media_assets',
  {
    id: primaryId(),

    kind: mediaKindEnum('kind').notNull(),
    provider: mediaProviderEnum('provider').notNull(),

    /** Идентификатор файла у поставщика */
    externalId: text('external_id'),
    /** Ключ воспроизведения для видео */
    playbackId: text('playback_id'),
    /** Прямой адрес — только для файлов в своём хранилище */
    url: text('url'),

    title: text('title'),
    durationSec: integer('duration_sec'),
    sizeBytes: bigint('size_bytes', { mode: 'number' }),

    processingStatus: mediaProcessingStatusEnum('processing_status').notNull().default('uploading'),
    processingError: text('processing_error'),

    /** Можно ли скачивать. Для видео — всегда нет */
    isDownloadable: boolean('is_downloadable').notNull().default(false),

    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('media_assets_kind_idx').on(table.kind),
    index('media_assets_status_idx').on(table.processingStatus),
  ],
)

/**
 * Привязка файла к содержимому: табы, минусовки, конспекты.
 *
 * Полиморфная связь — тот же приём и та же плата, что у меток: внешнего
 * ключа на объект нет, потому что объектом может быть песня, вариант
 * разбора, часть, урок, эфир или новость.
 *
 * Альтернатива — колонка `pdf_asset_id` в каждой таблице — ломается
 * на втором файле: у разбора бывают и PDF, и Guitar Pro, и минусовка,
 * а иногда два PDF для разных строёв. Колонками это выражается только
 * добавлением колонок, то есть миграцией на каждый новый вид материала.
 *
 * Один и тот же файл может быть привязан к нескольким местам: минусовка
 * песни нужна и на странице песни, и в уроке курса, который её разбирает.
 * Файл при этом хранится один раз.
 */
export const attachments = pgTable(
  'attachments',
  {
    id: primaryId(),

    entityType: contentEntityEnum('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),

    mediaAssetId: uuid('media_asset_id')
      .notNull()
      .references(() => mediaAssets.id, { onDelete: 'cascade' }),

    /** Как назвать материал участнику: «Табы (PDF)», «Минусовка» */
    title: text('title'),
    orderIndex: integer('order_index').notNull().default(0),

    createdAt: createdAt(),
  },
  (table) => [
    index('attachments_entity_idx').on(table.entityType, table.entityId),
    index('attachments_asset_idx').on(table.mediaAssetId),
  ],
)
