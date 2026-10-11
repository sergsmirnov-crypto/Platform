/**
 * Сборка всех таблиц в одну схему.
 *
 * Drizzle нужен единый объект со всеми таблицами, чтобы строить миграции
 * и типизировать запросы. Сами таблицы при этом живут в своих модулях —
 * так всё, что относится к подпискам, лежит в модуле подписок,
 * а не в общей свалке.
 *
 * Добавляя новый модуль с таблицами, не забудьте дописать его сюда,
 * иначе миграции его не увидят.
 */
export * from '@/modules/identity/schema'
export * from '@/modules/access/schema'
export * from '@/modules/subscription/schema'
export * from '@/modules/media/schema'
export * from '@/modules/audit/schema'
export * from '@/modules/settings/schema'
export * from '@/modules/taxonomy/schema'
export * from '@/modules/songs/schema'
export * from '@/modules/course/schema'
export * from '@/modules/progress/schema'
export * from '@/modules/library/schema'
export * from '@/modules/notifications/schema'
export * from '@/modules/news/schema'
export * from '@/modules/streams/schema'
export * from '@/modules/club/schema'
export * from '@/modules/legal/schema'
