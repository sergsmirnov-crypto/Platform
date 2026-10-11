import { PERMISSION_KEYS } from './permissions.catalog'

/**
 * Пресеты ролей.
 *
 * Источник — PRD v0.3 §2.3. Роль — это удобный набор прав на каждый день;
 * точечные отклонения делаются персональными исключениями, без создания
 * новых ролей.
 */

export type RoleScope = 'own' | 'all'

export type RoleDefinition = {
  code: string
  title: string
  description: string
  orderIndex: number
  /** Ключ права → область действия (или null, если право не имеет области) */
  permissions: Record<string, RoleScope | null>
}

/** Права без области действия записываются как null */
function plain(...keys: string[]): Record<string, RoleScope | null> {
  return Object.fromEntries(keys.map((key) => [key, null]))
}

const CURATOR_PERMISSIONS: RoleDefinition['permissions'] = {
  ...plain(
    'songs.view_drafts',
    'songs.create',
    'songs.publish',
    'streams.view_drafts',
    'streams.create',
    'streams.publish',
    'media.upload',
  ),
  // Базовый куратор правит только свой контент: случайно испортить
  // чужой разбор он не может
  'songs.edit': 'own',
  'streams.edit': 'own',
  'curators.edit': 'own',
}

const SENIOR_CURATOR_PERMISSIONS: RoleDefinition['permissions'] = {
  ...CURATOR_PERMISSIONS,
  ...plain(
    'songs.delete',
    'streams.delete',
    'course.view_drafts',
    'course.create',
    'course.edit',
    'course.publish',
    'course.delete',
    'course.reorder',
    'news.create',
    'news.edit',
    'news.publish',
    'news.delete',
    'media.view_all',
    'media.delete',
    'users.view',
  ),
  'songs.edit': 'all',
  'streams.edit': 'all',
  'curators.edit': 'all',
}

const ADMIN_PERMISSIONS: RoleDefinition['permissions'] = {
  ...SENIOR_CURATOR_PERMISSIONS,
  ...plain(
    'users.edit',
    'users.roles',
    'users.ban',
    'subs.view',
    'subs.grant',
    'settings.edit',
    'flags.edit',
    'audit.view',
  ),
}

/** Владелец получает всё, что есть в справочнике, — включая права, добавленные позже */
const OWNER_PERMISSIONS: RoleDefinition['permissions'] = Object.fromEntries(
  PERMISSION_KEYS.map((key) => [key, ADMIN_PERMISSIONS[key] ?? 'all']),
)

export const ROLES: RoleDefinition[] = [
  {
    code: 'curator',
    title: 'Куратор',
    description: 'Ведёт свои разборы и эфиры. Чужой контент не трогает.',
    orderIndex: 10,
    permissions: CURATOR_PERMISSIONS,
  },
  {
    code: 'senior_curator',
    title: 'Старший куратор',
    description: 'Работает со всем контентом платформы, включая курс и новости.',
    orderIndex: 20,
    permissions: SENIOR_CURATOR_PERMISSIONS,
  },
  {
    code: 'admin',
    title: 'Администратор',
    description: 'Управляет участниками, правами, подписками и настройками.',
    orderIndex: 30,
    permissions: ADMIN_PERMISSIONS,
  },
  {
    code: 'owner',
    title: 'Владелец',
    description:
      'Полный доступ. Роль неудаляемая, права неотзываемые. ' +
      'Владелец всегда существует минимум один — защита от потери доступа к платформе.',
    orderIndex: 40,
    permissions: OWNER_PERMISSIONS,
  },
]

export const OWNER_ROLE_CODE = 'owner'
