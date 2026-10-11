/**
 * Ключи действий, попадающих в журнал.
 *
 * Собраны в одном месте по той же причине, что и права: строка `'preview.enter'`,
 * написанная руками в трёх файлах, рано или поздно превратится в
 * `'preview_enter'` в четвёртом — и запись потеряется при поиске.
 *
 * Правило именования: `объект.действие` в единственном числе.
 * Список пополняется по мере появления управляющих действий.
 */
export const AUDIT_ACTIONS = {
  /** Куратор включил режим «смотреть как участник» */
  previewEnter: 'preview.enter',
  /** Куратор вернулся к управлению */
  previewExit: 'preview.exit',
  /** Участник удалил свой аккаунт */
  accountDelete: 'account.delete',

  /**
   * Участник заблокирован.
   *
   * Одно из немногих действий, где запись в журнал важнее самого действия:
   * блокировка выглядит для человека как поломка платформы, и ответ
   * на вопрос «кто и почему» должен находиться, а не вспоминаться
   */
  userBlock: 'user.block',
  /** Блокировка снята */
  userUnblock: 'user.unblock',

  /**
   * Изменение прав.
   *
   * Самые важные записи журнала. «Почему у Ивана пропала кнопка
   * публикации» иначе решается перепиской, а здесь — за десять секунд
   */
  roleGrant: 'role.grant',
  roleRevoke: 'role.revoke',
  permissionOverride: 'permission.override',
  permissionReset: 'permission.reset',

  /**
   * Ручное вмешательство в подписку.
   *
   * Применяется, когда автоматика ошиблась, а человек заплатил. Через
   * месяц вопрос «почему у него доступ, хотя он не в канале» должен
   * решаться чтением журнала, а не догадками
   */
  subscriptionGrant: 'subscription.grant',
  subscriptionRevoke: 'subscription.revoke',

  /**
   * Изменение настройки платформы.
   *
   * Тексты страницы «О клубе» и ссылки на чаты видят все участники,
   * и «кто это поменял» — вопрос, который однажды возникнет
   */
  settingsUpdate: 'settings.update',

  /** Куратор завёл новый разбор */
  songCreate: 'song.create',
  /** Куратор изменил поля песни */
  songEdit: 'song.edit',
  /** Разбор стал виден участникам */
  songPublish: 'song.publish',
  /** Разбор снят с публикации и вернулся в черновики */
  songUnpublish: 'song.unpublish',
  /** Разбор убран в архив */
  songArchive: 'song.archive',
  /** Добавлен вариант разбора */
  arrangementCreate: 'arrangement.create',
  /** Вариант разбора удалён */
  arrangementDelete: 'arrangement.delete',
  /**
   * Материал снят с содержимого.
   *
   * Записывается именно удаление, а не загрузка: «куда делись табы»
   * — вопрос, который задают, а «кто загрузил» видно по самому файлу.
   */
  materialDelete: 'material.delete',

  /** Модуль или урок курса опубликован */
  coursePublish: 'course.publish',
  /** Модуль или урок снят с публикации */
  courseUnpublish: 'course.unpublish',
  /** Модуль или урок удалён */
  courseDelete: 'course.delete',

  /** Куратор завёл эфир */
  streamCreate: 'stream.create',
  /** Эфир стал виден участникам */
  streamPublish: 'stream.publish',
  /** Эфир снят с публикации */
  streamUnpublish: 'stream.unpublish',
  /**
   * Эфир удалён.
   *
   * Записывается обязательно: вместе с эфиром исчезают оглавление
   * и связи с разборами, а вопрос «куда делся эфир про баррэ» задают
   * через месяц, когда вспомнить уже некому
   */
  streamDelete: 'stream.delete',

  /** Куратор завёл новость */
  newsCreate: 'news.create',
  /** Новость стала видна участникам */
  newsPublish: 'news.publish',
  /** Новость снята с публикации */
  newsUnpublish: 'news.unpublish',
  /** Новость удалена. Восстановить нечем — в журнале остаётся заголовок */
  newsDelete: 'news.delete',
} as const

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]
