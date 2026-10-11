import { AUDIT_ACTIONS } from './actions.catalog'

import type { AuditAction } from './actions.catalog'

/**
 * Как действие выглядит для человека, читающего журнал.
 *
 * ─────────────────────────────────────────────────────────────────
 * ОДНА ТАБЛИЦА ВМЕСТО ТРЁХ
 *
 * У каждого действия нужно знать три вещи: как его назвать по-русски,
 * в какой раздел отбора оно попадает и как назвать объект, над которым
 * оно совершено. Три отдельных списка неизбежно разошлись бы: кто-то
 * добавил бы действие в каталог и забыл про раздел, и запись перестала
 * бы находиться отбором, оставаясь в общем списке.
 *
 * Здесь это одна строка на действие, а полнота проверяется типом:
 * добавить действие в `AUDIT_ACTIONS` и не описать его тут — ошибка
 * сборки, а не сюрприз через полгода.
 * ─────────────────────────────────────────────────────────────────
 *
 * Формулировки в прошедшем времени и без подлежащего: строка читается
 * как «Иван Петров · опубликовал разбор · Nothing Else Matters».
 * Род не указывается — «опубликовал» для Марии выглядело бы небрежно,
 * поэтому выбраны нейтральные отглагольные формы там, где это возможно.
 */

/** Разделы отбора. Порядок — порядок кнопок на экране */
export const LOG_GROUPS = ['songs', 'streams', 'course', 'people', 'subs', 'system'] as const
export type LogGroup = (typeof LOG_GROUPS)[number]

export type ActionDescriptor = {
  /** Что произошло: «опубликован разбор», «снята блокировка» */
  label: string
  group: LogGroup
  /**
   * Заметное действие: удаление, изменение прав, вмешательство в подписку.
   *
   * Помечается на экране. Не «опасное» — просто то, о чём чаще всего
   * и спрашивают, когда открывают журнал
   */
  notable?: boolean
}

export const ACTION_CATALOG: Record<AuditAction, ActionDescriptor> = {
  [AUDIT_ACTIONS.songCreate]: { label: 'создан разбор', group: 'songs' },
  [AUDIT_ACTIONS.songEdit]: { label: 'изменён разбор', group: 'songs' },
  [AUDIT_ACTIONS.songPublish]: { label: 'опубликован разбор', group: 'songs' },
  [AUDIT_ACTIONS.songUnpublish]: { label: 'разбор снят с публикации', group: 'songs' },
  [AUDIT_ACTIONS.songArchive]: { label: 'разбор убран в архив', group: 'songs', notable: true },
  [AUDIT_ACTIONS.arrangementCreate]: { label: 'добавлен вариант разбора', group: 'songs' },
  [AUDIT_ACTIONS.arrangementDelete]: {
    label: 'удалён вариант разбора',
    group: 'songs',
    notable: true,
  },
  [AUDIT_ACTIONS.materialDelete]: { label: 'удалён материал', group: 'songs', notable: true },

  [AUDIT_ACTIONS.streamCreate]: { label: 'создан эфир', group: 'streams' },
  [AUDIT_ACTIONS.streamPublish]: { label: 'опубликован эфир', group: 'streams' },
  [AUDIT_ACTIONS.streamUnpublish]: { label: 'эфир снят с публикации', group: 'streams' },
  [AUDIT_ACTIONS.streamDelete]: { label: 'удалён эфир', group: 'streams', notable: true },

  [AUDIT_ACTIONS.newsCreate]: { label: 'создана новость', group: 'system' },
  [AUDIT_ACTIONS.newsPublish]: { label: 'опубликована новость', group: 'system' },
  [AUDIT_ACTIONS.newsUnpublish]: { label: 'новость снята с публикации', group: 'system' },
  [AUDIT_ACTIONS.newsDelete]: { label: 'удалена новость', group: 'system', notable: true },

  [AUDIT_ACTIONS.coursePublish]: { label: 'опубликовано в курсе', group: 'course' },
  [AUDIT_ACTIONS.courseUnpublish]: { label: 'снято с публикации в курсе', group: 'course' },
  [AUDIT_ACTIONS.courseDelete]: { label: 'удалено из курса', group: 'course', notable: true },

  [AUDIT_ACTIONS.userBlock]: { label: 'участник заблокирован', group: 'people', notable: true },
  [AUDIT_ACTIONS.userUnblock]: { label: 'блокировка снята', group: 'people' },
  [AUDIT_ACTIONS.roleGrant]: { label: 'изменена роль', group: 'people', notable: true },
  [AUDIT_ACTIONS.roleRevoke]: { label: 'выведен из команды', group: 'people', notable: true },
  [AUDIT_ACTIONS.permissionOverride]: {
    label: 'изменено отдельное право',
    group: 'people',
    notable: true,
  },
  [AUDIT_ACTIONS.permissionReset]: { label: 'права возвращены к роли', group: 'people' },
  [AUDIT_ACTIONS.accountDelete]: { label: 'участник удалил свой аккаунт', group: 'people' },

  [AUDIT_ACTIONS.subscriptionGrant]: {
    label: 'доступ выдан вручную',
    group: 'subs',
    notable: true,
  },
  [AUDIT_ACTIONS.subscriptionRevoke]: {
    label: 'доступ отозван вручную',
    group: 'subs',
    notable: true,
  },

  [AUDIT_ACTIONS.settingsUpdate]: { label: 'изменена настройка', group: 'system' },
  [AUDIT_ACTIONS.previewEnter]: { label: 'включён режим «как участник»', group: 'system' },
  [AUDIT_ACTIONS.previewExit]: { label: 'выключен режим «как участник»', group: 'system' },
}

/** Действия одного раздела. Считается один раз при загрузке файла */
const BY_GROUP = new Map<LogGroup, string[]>(
  LOG_GROUPS.map((group) => [
    group,
    Object.entries(ACTION_CATALOG)
      .filter(([, descriptor]) => descriptor.group === group)
      .map(([action]) => action),
  ]),
)

export function actionsOfGroup(group: LogGroup): string[] {
  return BY_GROUP.get(group) ?? []
}

/**
 * Описание действия.
 *
 * Незнакомое действие не прячется и не роняет страницу: показывается
 * его ключ. Так запись, сделанная новым кодом до обновления каталога,
 * остаётся видимой — а пропущенная запись была бы хуже некрасивой.
 */
export function describeAction(action: string): ActionDescriptor {
  return ACTION_CATALOG[action as AuditAction] ?? { label: action, group: 'system' }
}
