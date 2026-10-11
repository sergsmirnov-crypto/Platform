import 'server-only'

/**
 * Точка входа для фоновых задач.
 *
 * Отдельный файл, а не публичный вход модуля: `index.ts` попадает
 * в браузер вместе с каталогом типов и текстами, и тянуть за собой
 * доставку в Telegram ему нельзя.
 */
export { deliverDigest, notifyAndDeliver } from './delivery'
export { notifyMany, notifyOne, purgeOldFeed } from './service'
