/**
 * Справочник всех прав платформы.
 *
 * Источник — PRD v0.3 §2.2. Это единственное место, где перечислены права:
 * отсюда они попадают в базу при первоначальном заполнении, отсюда же
 * берутся ключи, которыми код проверяет доступ.
 *
 * Добавляя право, допишите его сюда и запустите `pnpm db:seed`.
 */

export type PermissionDefinition = {
  key: string
  groupKey: string
  title: string
  description?: string
  /** Поддерживает разделение «только свой контент» / «любой контент» */
  isScoped?: boolean
  /** Опасное право: выдача требует подтверждения и пишется в журнал */
  isSensitive?: boolean
}

export const PERMISSION_GROUPS: Record<string, string> = {
  songs: 'Разборы',
  streams: 'Эфиры',
  course: 'Курс',
  news: 'Новости',
  media: 'Медиатека',
  curators: 'Кураторы',
  users: 'Участники',
  subs: 'Подписки',
  system: 'Система',
}

export const PERMISSIONS: PermissionDefinition[] = [
  // ─── Разборы ───
  { key: 'songs.view_drafts', groupKey: 'songs', title: 'Видеть неопубликованные разборы' },
  { key: 'songs.create', groupKey: 'songs', title: 'Создавать разборы' },
  { key: 'songs.edit', groupKey: 'songs', title: 'Редактировать разборы', isScoped: true },
  { key: 'songs.publish', groupKey: 'songs', title: 'Публиковать и снимать с публикации' },
  { key: 'songs.delete', groupKey: 'songs', title: 'Удалять разборы в архив' },

  // ─── Эфиры ───
  { key: 'streams.view_drafts', groupKey: 'streams', title: 'Видеть неопубликованные эфиры' },
  { key: 'streams.create', groupKey: 'streams', title: 'Создавать эфиры' },
  { key: 'streams.edit', groupKey: 'streams', title: 'Редактировать эфиры', isScoped: true },
  { key: 'streams.publish', groupKey: 'streams', title: 'Публиковать записи эфиров' },
  { key: 'streams.delete', groupKey: 'streams', title: 'Удалять эфиры' },

  // ─── Курс ───
  { key: 'course.view_drafts', groupKey: 'course', title: 'Видеть неопубликованные уроки' },
  { key: 'course.create', groupKey: 'course', title: 'Создавать модули и уроки' },
  { key: 'course.edit', groupKey: 'course', title: 'Редактировать курс' },
  { key: 'course.publish', groupKey: 'course', title: 'Публиковать уроки' },
  { key: 'course.delete', groupKey: 'course', title: 'Удалять модули и уроки' },
  { key: 'course.reorder', groupKey: 'course', title: 'Менять порядок модулей и уроков' },

  // ─── Новости ───
  { key: 'news.create', groupKey: 'news', title: 'Создавать новости' },
  { key: 'news.edit', groupKey: 'news', title: 'Редактировать новости' },
  { key: 'news.publish', groupKey: 'news', title: 'Публиковать новости' },
  { key: 'news.delete', groupKey: 'news', title: 'Удалять новости' },

  // ─── Медиатека ───
  { key: 'media.upload', groupKey: 'media', title: 'Загружать файлы и видео' },
  { key: 'media.view_all', groupKey: 'media', title: 'Видеть всю медиатеку' },
  { key: 'media.delete', groupKey: 'media', title: 'Удалять файлы' },

  // ─── Кураторы ───
  {
    key: 'curators.edit',
    groupKey: 'curators',
    title: 'Редактировать карточки кураторов',
    isScoped: true,
  },

  // ─── Участники ───
  { key: 'users.view', groupKey: 'users', title: 'Видеть список участников и их профили' },
  { key: 'users.edit', groupKey: 'users', title: 'Редактировать чужой профиль' },
  {
    key: 'users.roles',
    groupKey: 'users',
    title: 'Выдавать права другим',
    description: 'Позволяет назначать роли и персональные исключения',
    isSensitive: true,
  },
  { key: 'users.ban', groupKey: 'users', title: 'Блокировать участников', isSensitive: true },

  // ─── Подписки ───
  { key: 'subs.view', groupKey: 'subs', title: 'Видеть статусы и историю подписок' },
  {
    key: 'subs.grant',
    groupKey: 'subs',
    title: 'Выдавать и отзывать доступ вручную',
    isSensitive: true,
  },

  // ─── Система ───
  { key: 'settings.edit', groupKey: 'system', title: 'Менять настройки платформы' },
  { key: 'flags.edit', groupKey: 'system', title: 'Управлять переключателями возможностей' },
  { key: 'audit.view', groupKey: 'system', title: 'Смотреть журнал действий' },
]

/** Все ключи прав — для проверок и подсказок редактора */
export const PERMISSION_KEYS = PERMISSIONS.map((permission) => permission.key)
export type PermissionKey = (typeof PERMISSION_KEYS)[number]
