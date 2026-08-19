import 'server-only'

import { eq } from 'drizzle-orm'

import { db } from '@/shared/db'
import { getLogger } from '@/shared/logger'

import { SETTING_DEFAULTS } from './catalog'
import { appSettings } from './schema'

import type { SettingKey } from './catalog'

/**
 * Чтение и запись настроек платформы.
 *
 * Правило: **отсутствие настройки — не ошибка.** Возвращается значение
 * по умолчанию. Платформа обязана работать на чистой базе: иначе первый
 * же запуск на новом сервере встречает разработчика падением, причина
 * которого — незаполненная строка в таблице.
 */

export async function getSetting<T>(key: SettingKey): Promise<T> {
  const fallback = SETTING_DEFAULTS[key] as T

  try {
    const [row] = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .limit(1)

    return (row?.value as T) ?? fallback
  } catch (error) {
    // Настройки — украшение страницы, а не её суть. Недоступная база
    // не должна валить главную целиком: покажем без карточек чатов
    getLogger().error({ err: error, settingKey: key }, 'не удалось прочитать настройку')
    return fallback
  }
}

export async function setSetting(
  key: SettingKey,
  value: unknown,
  updatedBy: string | null,
): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key, value, updatedBy })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedBy, updatedAt: new Date() },
    })
}
