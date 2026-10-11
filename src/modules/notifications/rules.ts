import { isKnownNotificationType, NOTIFICATION_CATALOG, NOTIFICATION_LIST } from './catalog'

import type { NotificationType, NotificationTypeDefinition } from './catalog'

/**
 * Правила уведомлений — чистые функции без базы и без сети.
 */

/** Настройка человека: тип и его состояние */
export type PreferenceOverride = {
  type: string
  enabled: boolean
}

export type ResolvedPreference = NotificationTypeDefinition & {
  enabled: boolean
  /** Отличается ли от значения по умолчанию — для подсветки в настройках */
  isOverridden: boolean
}

/**
 * Итоговые настройки: каталог плюс личные отклонения.
 *
 * Отклонения по неизвестным типам молча пропускаются: тип могли убрать
 * из каталога, а строка в базе осталась. Падать из-за этого при открытии
 * настроек нельзя.
 *
 * Неотключаемые типы остаются включёнными, даже если в базе лежит
 * отказ: настройку могли записать до того, как тип стал обязательным.
 * Правило живёт в каталоге, и база не должна его переспорить.
 */
export function resolvePreferences(overrides: PreferenceOverride[]): ResolvedPreference[] {
  const byType = new Map(
    overrides.filter((item) => isKnownNotificationType(item.type)).map((item) => [item.type, item]),
  )

  return NOTIFICATION_LIST.map((definition) => {
    const override = byType.get(definition.key)

    if (!definition.canDisable) {
      return { ...definition, enabled: true, isOverridden: false }
    }

    if (!override) {
      return { ...definition, enabled: definition.defaultEnabled, isOverridden: false }
    }

    return {
      ...definition,
      enabled: override.enabled,
      isOverridden: override.enabled !== definition.defaultEnabled,
    }
  })
}

/** Хочет ли человек получать уведомления этого типа */
export function isEnabledFor(type: NotificationType, overrides: PreferenceOverride[]): boolean {
  return resolvePreferences(overrides).find((item) => item.key === type)?.enabled ?? false
}

/**
 * Нужно ли отправлять сразу.
 *
 * Всё остальное копится до вечерней сводки. Разделение задано каталогом,
 * а не решением на месте: иначе «а это же важное» однажды окажется
 * написано у каждого второго типа.
 */
export function isImmediate(type: NotificationType): boolean {
  return NOTIFICATION_CATALOG[type].delivery === 'now'
}

/** Сводка: что накопилось, одним сообщением */
export type DigestItem = {
  type: NotificationType
  title: string
}

/**
 * Текст вечерней сводки.
 *
 * ─────────────────────────────────────────────────────────────────
 * ОДНО СООБЩЕНИЕ, А НЕ ПЯТЬ
 *
 * Три разбора и запись эфира за вечер — это одно сообщение из четырёх
 * строк, а не четыре уведомления. Ограничение из PRD (§7.5) здесь
 * не декоративное: человек, которому бот пишет по пять раз в день,
 * выключает бота целиком — и перестаёт получать в том числе то,
 * ради чего уведомления затевались.
 * ─────────────────────────────────────────────────────────────────
 *
 * Одна накопившаяся новость отправляется как есть, без слова «сводка»:
 * «Что нового в клубе: 1 пункт» выглядит нелепо.
 */
export function buildDigestText(items: DigestItem[], appUrl: string): string | null {
  if (items.length === 0) return null

  if (items.length === 1 && items[0]) {
    return `${items[0].title}\n\n${appUrl}`
  }

  const lines = items.map((item) => `• ${item.title}`)

  return `Что нового в клубе:\n\n${lines.join('\n')}\n\n${appUrl}`
}

/**
 * Сколько непрочитанных показывать значком.
 *
 * Выше предела — «99+»: точное число в этот момент уже ничего не значит,
 * а трёхзначный значок ломает разметку шапки.
 */
export function formatUnreadBadge(count: number, limit = 99): string | null {
  if (count <= 0) return null

  return count > limit ? `${limit}+` : String(count)
}
