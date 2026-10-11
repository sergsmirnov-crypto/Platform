/**
 * Публичный вход модуля «Клуб».
 *
 * Наружу отдаются чистые вещи и типы; всё, что ходит в базу, живёт
 * в `service.ts` и подключается оттуда напрямую — так видно, какая
 * страница действительно читает данные, а какая просто рисует.
 */

export { clubStrings } from './strings'

export { curatorCardSchema } from './editor-schema'
export type { CuratorCardInput } from './editor-schema'

export type { CuratorCard, CuratorView, CuratorWork, MemberCard, MemberView } from './types'
export type { CityCount } from './members-repository'

export { curatorProfiles } from './schema'
