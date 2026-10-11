import 'server-only'

import { requirePermission } from '@/modules/access'
import { AUDIT_ACTIONS, recordAudit } from '@/modules/audit'
import { errors } from '@/shared/errors'
import { getLogger } from '@/shared/logger'

import { SETTING_DEFAULTS, SETTING_TITLES } from './catalog'
import { getSetting, setSetting } from './service'
import { SETTING_SCHEMAS, isEditableSetting } from './validation'

import type { ClubAbout, TelegramChatLink } from './catalog'
import type { EditableSettingKey } from './validation'

/**
 * Правка настроек платформы.
 *
 * Право проверяется здесь, как и во всех остальных модулях: скрытая
 * в интерфейсе кнопка — удобство, а не защита (ARCHITECTURE §6).
 *
 * До шага 9.6.1 проверка стояла в действии: настройки жили внутри
 * модуля журнала, а тот не мог спросить права у `access`, потому что
 * `access` сам писал в журнал. Кольцо разорвано, исключение снято.
 */

export type EditableSettings = {
  renewUrl: string
  chats: TelegramChatLink[]
  about: ClubAbout
}

export async function getEditableSettings(): Promise<EditableSettings> {
  const [renewUrl, chats, about] = await Promise.all([
    getSetting<string>('subscription.renew_url'),
    getSetting<TelegramChatLink[]>('telegram.chats'),
    getSetting<ClubAbout>('club.about'),
  ])

  return { renewUrl, chats, about }
}

/**
 * Записывает настройку, проверив значение.
 *
 * Ключ проверяется по списку: править из интерфейса можно только
 * перечисленное. Иначе произвольная строка в запросе позволила бы
 * записать что угодно под любым ключом — включая те, которые появятся
 * в будущем и не рассчитаны на правку человеком.
 */
export async function updateSetting(
  actorId: string,
  key: string,
  value: unknown,
  context: { ipHash?: string | null } = {},
): Promise<void> {
  await requirePermission(actorId, 'settings.edit')

  if (!isEditableSetting(key)) {
    throw errors.notFound('Такой настройки нет')
  }

  const parsed = SETTING_SCHEMAS[key].safeParse(value)

  if (!parsed.success) {
    const issue = parsed.error.issues[0]

    throw errors.validation(
      { [issue?.path.join('.') || 'value']: issue?.message ?? 'Значение не подходит' },
      issue?.message ?? 'Значение не подходит',
    )
  }

  await setSetting(key, parsed.data, actorId)

  await recordAudit({
    actorId,
    action: AUDIT_ACTIONS.settingsUpdate,
    entityType: 'setting',
    entityId: key,
    entityTitle: SETTING_TITLES[key],
    ipHash: context.ipHash ?? null,
  })

  getLogger().info({ actorId, settingKey: key }, 'настройка платформы изменена')
}

/**
 * Возвращает настройку к исходному значению.
 *
 * Нужно ровно тогда, когда текст правили-правили и испортили: вернуть
 * заводской вариант проще, чем вспоминать, как было.
 */
export async function resetSetting(
  actorId: string,
  key: EditableSettingKey,
  context: { ipHash?: string | null } = {},
): Promise<void> {
  await updateSetting(actorId, key, SETTING_DEFAULTS[key], context)
}
