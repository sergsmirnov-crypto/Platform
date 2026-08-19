/**
 * Каталог типов уведомлений.
 *
 * ─────────────────────────────────────────────────────────────────
 * ТИПЫ ЖИВУТ В КОДЕ, А НЕ В БАЗЕ
 *
 * Соблазн завести таблицу «типы уведомлений» и править её из админки
 * был. Отказался: у каждого типа есть не только название, но и способ
 * доставки, и текст, и место, куда ведёт ссылка, — то есть код. Строка
 * в базе без кода бесполезна, а код без строки работает.
 *
 * Настройка человека при этом хранится в базе — но как **исключение
 * из значения по умолчанию**, ровно как персональные права. Новый тип
 * появляется в коде и сразу работает у всех, кто не отказывался.
 * ─────────────────────────────────────────────────────────────────
 */

/**
 * Когда доставлять.
 *
 * `now` — сразу отдельным сообщением. Только то, где промедление меняет
 * смысл: эфир начнётся через сутки, доступ вот-вот закроется.
 *
 * `digest` — накопить и отправить одним сообщением раз в день. Сюда
 * попадает всё содержимое: три новых разбора за вечер не должны стать
 * тремя сообщениями (PRD v0.1 §7.5 — не более одного в день).
 */
export type NotificationDelivery = 'now' | 'digest'

export type NotificationTypeDefinition = {
  key: NotificationType
  /** Название в настройках */
  title: string
  /** Пояснение под названием */
  description: string
  delivery: NotificationDelivery
  /**
   * Включён ли по умолчанию.
   *
   * Выключенным по умолчанию не бывает ничего: человек, который не хочет
   * знать о новых разборах, выключит их сам, а человек, который хочет,
   * никогда не найдёт выключенную настройку и решит, что платформа
   * мертва.
   */
  defaultEnabled: boolean
  /**
   * Можно ли отказаться.
   *
   * «Подписка заканчивается» отключить нельзя: это не новость, а
   * предупреждение о потере оплаченного доступа. Всё остальное — можно.
   */
  canDisable: boolean
}

export const NOTIFICATION_TYPES = [
  'song.published',
  'stream.recorded',
  'stream.reminder',
  'club.news',
  'subscription.expiring',
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const NOTIFICATION_CATALOG: Record<NotificationType, NotificationTypeDefinition> = {
  'song.published': {
    key: 'song.published',
    title: 'Новые разборы',
    description: 'Когда куратор публикует разбор песни',
    delivery: 'digest',
    defaultEnabled: true,
    canDisable: true,
  },

  'stream.recorded': {
    key: 'stream.recorded',
    title: 'Записи эфиров',
    description: 'Когда запись прошедшего эфира выложена',
    delivery: 'digest',
    defaultEnabled: true,
    canDisable: true,
  },

  'stream.reminder': {
    key: 'stream.reminder',
    title: 'Напоминание об эфире',
    description: 'За сутки до начала',
    // Сразу и отдельным сообщением: в сводке, которая придёт вечером,
    // напоминание о завтрашнем эфире бесполезно
    delivery: 'now',
    defaultEnabled: true,
    canDisable: true,
  },

  'club.news': {
    key: 'club.news',
    title: 'Новости клуба',
    description: 'Объявления, итоги челленджей, расписание',
    delivery: 'digest',
    defaultEnabled: true,
    canDisable: true,
  },

  'subscription.expiring': {
    key: 'subscription.expiring',
    title: 'Подписка заканчивается',
    description: 'Предупреждение о скором закрытии доступа',
    delivery: 'now',
    defaultEnabled: true,
    canDisable: false,
  },
}

export const NOTIFICATION_LIST: NotificationTypeDefinition[] = NOTIFICATION_TYPES.map(
  (key) => NOTIFICATION_CATALOG[key],
)

/** Известен ли тип. Значения приходят из базы, где могли остаться старые */
export function isKnownNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value)
}
